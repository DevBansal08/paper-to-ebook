'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      localStorage.setItem('ebookData', JSON.stringify(data));
      router.push('/reader');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to process PDF. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-12 space-y-4">
        <h1 className="text-5xl font-bold tracking-tighter bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
          Paper to eBook
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-lg max-w-md mx-auto">
          Transform dense research papers into beautiful, readable eBooks instantly.
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          w-full max-w-xl p-12 rounded-3xl border-2 border-dashed transition-all duration-300 ease-out
          flex flex-col items-center justify-center gap-6 cursor-pointer
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 scale-102 shadow-xl'
              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-sm'
          }
        `}
      >
        <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-neutral-900 dark:text-white">
            {isUploading ? 'Processing...' : 'Drop your PDF here'}
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            or <span className="text-blue-600 cursor-pointer hover:underline">browse files</span>
          </p>
        </div>
        
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileSelect}
          id="file-upload"
        />
        <label htmlFor="file-upload" className="absolute inset-0 cursor-pointer" />
      </div>

      {isUploading && (
        <div className="mt-8 flex items-center gap-3 text-neutral-500 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
    </div>
  );
}
