'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ContentItem {
  type: 'text' | 'image';
  value: string;
  caption?: string;
}

interface Section {
  title: string;
  content: ContentItem[];
  id: string;
  level: number;
}

interface EbookData {
  title: string;
  sections: Section[];
}

import { ScrollArea } from '@/components/ui/scroll-area';

export default function ReaderPage() {
  const [data, setData] = useState<EbookData | null>(null);
  const [activeSection, setActiveSection] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const storedData = localStorage.getItem('ebookData');
    if (!storedData) {
      router.push('/');
      return;
    }
    try {
      const parsed = JSON.parse(storedData);
      if (parsed.sections && parsed.sections.length > 0) {
        if (!Array.isArray(parsed.sections[0].content)) {
            console.warn("Detected stale data format. Clearing and redirecting.");
            localStorage.removeItem('ebookData');
            router.push('/');
            return;
        }
      }
      setData(parsed);
    } catch (e) {
      console.error('Failed to parse ebook data', e);
      localStorage.removeItem('ebookData');
      router.push('/');
    }
  }, [router]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Sidebar - TOC */}
      <aside className="w-80 border-r border-neutral-200 dark:border-neutral-800 flex flex-col bg-neutral-50/50 dark:bg-neutral-900/50 backdrop-blur-xl shrink-0 h-full overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <h2 className="font-semibold text-neutral-900 dark:text-white truncate" title={data.title}>
            {data.title}
          </h2>
          <p className="text-xs text-neutral-500 mt-1 uppercase tracking-wider font-medium">Table of Contents</p>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-1">
            {data.sections.map((section, idx) => (
              <div key={idx} className="relative">
                  {/* Visual hierarchy lines */}
                  {section.level > 1 && (
                      <div 
                          className="absolute left-[18px] top-0 bottom-0 border-l border-neutral-200 dark:border-neutral-700" 
                          style={{ left: `${(section.level - 1) * 16 + 8}px` }}
                      />
                  )}
                  
                  <button
                      onClick={() => scrollToSection(section.id)}
                      className={`
                          w-full text-left py-1.5 pr-2 rounded-md text-sm transition-colors duration-200 flex items-center
                          ${
                          activeSection === section.id
                              ? 'text-blue-600 dark:text-blue-400 font-semibold'
                              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                          }
                      `}
                      style={{ paddingLeft: `${section.level * 16}px` }}
                  >
                      <span className="truncate">{section.title}</span>
                  </button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 shrink-0">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Upload another paper
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <ScrollArea className="flex-1 bg-white dark:bg-neutral-950">
        <div className="max-w-3xl mx-auto px-12 py-16">
          {data.sections.map((section, idx) => (
            <section
              id={section.id}
              key={idx}
              className="mb-16 scroll-mt-12"
              onMouseEnter={() => setActiveSection(section.id)}
            >
              <h3 className={`font-bold text-neutral-900 dark:text-white mb-6 pb-2
                ${section.level === 1 ? 'text-3xl border-b border-neutral-100 dark:border-neutral-800' : 'text-xl mt-8'}
              `}>
                {section.title}
              </h3>
              
              <div className="space-y-4">
                {section.content.map((item, cIdx) => (
                   <div key={cIdx}>
                     {item.type === 'text' && (
                        <p className="font-serif text-lg leading-relaxed text-neutral-700 dark:text-neutral-300">
                          {item.value}
                        </p>
                     )}
                     {item.type === 'image' && (
                       <figure className="my-8 rounded-xl overflow-hidden shadow-lg border border-neutral-200 dark:border-neutral-800">
                         <img 
                           src={item.value} 
                           alt="Paper Figure" 
                           className="w-full h-auto object-contain bg-neutral-100 dark:bg-neutral-900"
                         />
                       </figure>
                     )}
                   </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
