/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle2, ImagePlus } from 'lucide-react';
import { cn } from '../lib/utils';

interface ReceiptUploaderProps {
  onUpload: (file: File) => void;
  isProcessing: boolean;
}

export default function ReceiptUploader({ onUpload, isProcessing }: ReceiptUploaderProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles[0]);
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.jpeg', '.jpg', '.png']
    },
    multiple: false,
    disabled: isProcessing
  });

  return (
    <div 
      {...getRootProps()} 
      className={cn(
        "relative cursor-pointer group transition-all duration-300",
        "bg-slate-50 dark:bg-slate-800/60 border-2 border-dashed rounded-3xl px-6 py-10 md:p-10 text-center overflow-hidden",
        isDragActive ? "border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 scale-[1.01]" : "border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/25",
        isProcessing && "pointer-events-none opacity-80"
      )}
    >
      <input {...getInputProps()} />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-indigo-200 dark:via-indigo-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex flex-col items-center gap-4">
        {isProcessing ? (
          <div className="space-y-4 flex flex-col items-center">
            <div className="relative">
              <Loader2 className="w-16 h-16 text-indigo-600 dark:text-indigo-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">AI is parsing your receipt...</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Extracting items, identifying prices, and categorizing data.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center group-hover:border-indigo-200 dark:group-hover:border-indigo-500/40 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {isDragActive ? (
                <ImagePlus className="w-10 h-10 text-indigo-500 dark:text-indigo-400" />
              ) : (
                <Upload className="w-10 h-10 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {isDragActive ? "Drop it here" : "Drop receipt here"}
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                Drag a file into this area, or click anywhere in the panel to choose one.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                {['PDF', 'JPG', 'PNG'].map((type) => (
                  <span key={type} className="rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 px-3 py-1 text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-widest">
                    {type}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {isProcessing && (
        <div className="mt-8 space-y-3">
          <div className="h-1.5 w-48 mx-auto bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 dark:bg-indigo-500 animate-progress origin-left w-full" />
          </div>
          <div className="flex justify-center gap-4 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">
             <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Scanning</span>
             <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> OCR</span>
             <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">Categorizing</span>
          </div>
        </div>
      )}
    </div>
  );
}
