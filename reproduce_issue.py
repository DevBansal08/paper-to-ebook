import fitz
import requests
import sys

def create_pdf(filename="test.pdf"):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Hello World! This is a test PDF.")
    page.insert_text((50, 100), "1. Introduction")
    page.insert_text((50, 120), "This is the introduction text.")
    doc.save(filename)
    doc.close()
    return filename

def upload_pdf(filename="test.pdf"):
    url = "http://127.0.0.1:8000/upload"
    try:
        with open(filename, "rb") as f:
            files = {"file": (filename, f, "application/pdf")}
            response = requests.post(url, files=files)
            print(f"Status Code: {response.status_code}")
            print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    create_pdf()
    upload_pdf()
