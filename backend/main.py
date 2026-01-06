from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import io
import fitz # pymupdf
import base64
import re
from typing import List, Dict, Any, Optional

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def is_header(text: str) -> bool:
    stripped = text.strip()
    if len(stripped) < 4: return False
    # Blacklists
    if "....." in stripped: return False
    if re.search(r'\[\d+\]', stripped): return False
    if re.match(r'^(Table|Figure|Fig\.)', stripped, re.IGNORECASE): return False
    
    # Simple whitelist checks
    lower = stripped.lower()
    if lower in ["abstract", "introduction", "background", "related work", 
                 "methodology", "methods", "experiments", "results", 
                 "discussion", "conclusion", "conclusions", "references", 
                 "acknowledgments", "appendix"]:
        return True
        
    # Numbered: 1. Introduction, 1.1 Motivation, I. Overview
    # Fix: Restrict first digit group to max 2 digits (1-99) to avoid Years (2014)
    # ^(\d{1,2}  matches 1..99
    # (\.\d+)*   matches .1.2
    if re.match(r'^(\d{1,2}(\.\d+)*|I+|II|III|IV|V|VI|VII|VIII|IX|X)\.?\s+[A-Z]', stripped):
        return True
        
    # All caps valid header
    if stripped.isupper() and len(stripped) > 5 and re.match(r'^[A-Z\s:]+$', stripped):
         if not any(x in stripped for x in ["TABLE", "FIGURE", "HTTP"]):
             return True
             
    return False

def get_section_level(title: str) -> int:
    """Detect nesting level based on numbering (1. -> 1, 1.1 -> 2)"""
    match = re.match(r'^(\d+(\.\d+)*)', title)
    if match:
        return len(match.group(1).split('.'))
    return 1

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    content = await file.read()
    doc = fitz.open(stream=content, filetype="pdf")
    
    # Pass 1: Analyze Font Sizes to find Body Text
    font_sizes = {}
    all_spans = []
    
    for page in doc:
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if block["type"] == 0: # Text
                for line in block["lines"]:
                    for span in line["spans"]:
                        text = span["text"].strip()
                        if not text: continue
                        size = round(span["size"], 1)
                        font_sizes[size] = font_sizes.get(size, 0) + len(text)
                        all_spans.append({
                            "text": text,
                            "size": size,
                            "flags": span["flags"], # 2^4 = bold usually
                            "page": page.number,
                            "type": "text"
                        })
                # Mark block end for paragraph reconstruction
                all_spans.append({"type": "block_break"})
            elif block["type"] == 1: # Image
                image_bytes = block["image"]
                base64_img = base64.b64encode(image_bytes).decode('utf-8')
                ext = block["ext"]
                all_spans.append({
                    "type": "image",
                    "value": f"data:image/{ext};base64,{base64_img}",
                    "page": page.number
                })

    # Determine Body Font Size (most common size by character count)
    if font_sizes:
        body_font_size = max(font_sizes, key=font_sizes.get)
    else:
        body_font_size = 10.0 # fallback

    # Heuristic: Find Layout Title (Largest text on Page 1)
    # We look for the largest font size on page 0 that is significantly larger than body
    layout_title = ""
    max_title_size = 0
    for span in all_spans:
         # Skip block breaks or images for title search (images skipped by type check, but block_break has no page)
         if span.get("type") != "text":
             continue
             
         if span["page"] == 0:
             if span["size"] > max_title_size and span["size"] > body_font_size * 1.5:
                 max_title_size = span["size"]
                 layout_title = span["text"]
             elif span["size"] == max_title_size and max_title_size > 0:
                 # Append multi-line titles
                 layout_title += " " + span["text"]
    
    # Clean up title
    if layout_title:
        layout_title = re.sub(r'\s+', ' ', layout_title).strip()
    else:
        layout_title = file.filename.replace(".pdf", "")

    # Pass 2: Structure Detection
    sections = []
    current_section = {"title": "Abstract", "content": [], "id": "section-0", "level": 1}
    sections_list = [current_section]
    
    paragraph_buffer = ""
    
    for span in all_spans:
        if span["type"] == "block_break":
            # End of block: Flush buffer to content
            if paragraph_buffer:
                current_section["content"].append({"type": "text", "value": paragraph_buffer.strip()})
                paragraph_buffer = ""
            continue
            
        if span["type"] == "image":
            # Flush previous text
            if paragraph_buffer:
                current_section["content"].append({"type": "text", "value": paragraph_buffer.strip()})
                paragraph_buffer = ""
                
            current_section["content"].append(span)
            continue
            
        text = span["text"]
        size = span["size"]
        flags = span["flags"]
        
        is_bold = (flags & 16) > 0 or (flags & 4) > 0 
        is_larger = size > body_font_size + 0.5
        
        # --- Header Reconstruction Logic ---
        # Check if previous buffer was just a number (e.g., "1.", "2.1")
        # If so, merge it with current text to see if it forms a header "1. Introduction"
        potential_number = paragraph_buffer.strip()
        merged_text = text
        did_merge = False
        
        # Regex for standalone number/roman numeral
        if 0 < len(potential_number) < 10 and re.match(r'^(\d+(\.\d+)*|I+|II|III|IV|V|VI|X)\.?$', potential_number):
             merged_text = potential_number + " " + text
             did_merge = True

        candidate = False
        
        # Check 1: Is the (merged) text a Numbered Section? (e.g. "1. Introduction", "1.1 Motivation")
        # We trust this even if small font, as long as it's not a sentence (length check)
        if len(merged_text) < 80 and re.match(r'^(\d+(\.\d+)*|I+|II|III|IV|V|VI|X)\.?\s+[A-Z]', merged_text):
             # Ensure it's not just a random sentence starting with "1. The..." 
             # usually headers don't have verbs immediately or are short.
             candidate = True
        
        # Check 2: Large/Bold Header (Standard whitelist check)
        elif (is_larger or is_bold) and is_header(text):
             # If merging didn't help (or wasn't needed), check raw text
             candidate = True
             # If we have a pending number in buffer, we should probably prefer the merged version 
             # but only if the merged version ALSO looks valid?
             # Actually if "Introduction" is bold, and buffer is "1.", we WANT "1. Introduction".
             if did_merge:
                 candidate = True

        # Anti-Noise: If it matches Title exactly
        if candidate and (text.strip() == layout_title.strip() or merged_text.strip() == layout_title.strip()):
            candidate = False
            
        if candidate:
             # Apply merge if active
             if did_merge:
                 text = merged_text
                 paragraph_buffer = "" # Consumed the number
                 
             # Flush remaining buffer (though if merged, buffer matches, so empty)
             if paragraph_buffer:
                 current_section["content"].append({"type": "text", "value": paragraph_buffer.strip()})
                 paragraph_buffer = ""
             
             # Deduplicate
             if text == current_section["title"]:
                 pass # Skip
             else:
                 level = get_section_level(text)
                 new_section = {
                    "title": text, 
                    "content": [], 
                    "id": f"section-{len(sections_list)}",
                    "level": level
                 }
                 sections_list.append(new_section)
                 current_section = new_section
        else:
             # Content
             if paragraph_buffer:
                 if paragraph_buffer.endswith("-"):
                      paragraph_buffer = paragraph_buffer[:-1] + text 
                 else:
                      paragraph_buffer += " " + text
             else:
                 paragraph_buffer = text

    if paragraph_buffer:
        current_section["content"].append({"type": "text", "value": paragraph_buffer.strip()})

    final_sections = [s for s in sections_list if s["content"] or s["title"] != "Abstract"]
    
    return {"title": layout_title, "sections": final_sections}
