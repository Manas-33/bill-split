/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle2 } from 'lucide-react';
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
        "bg-white border-2 border-dashed rounded-3xl p-12 text-center",
        isDragActive ? "border-blue-500 bg-blue-50/50 scale-[1.01]" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
        isProcessing && "pointer-events-none opacity-80"
      )}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center gap-4">
        {isProcessing ? (
          <div className="space-y-4 flex flex-col items-center">
            <div className="relative">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xl font-bold tracking-tight">AI is parsing your receipt...</p>
              <p className="text-gray-500 text-sm">Extracting items, identifying prices, and categorizing data.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
              <Upload className="w-10 h-10 text-gray-400 group-hover:text-blue-500" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-bold tracking-tight">
                {isDragActive ? "Drop it here!" : "Click or drag receipt"}
              </p>
              <p className="text-gray-500 text-sm max-w-[240px] mx-auto leading-relaxed">
                Upload a PDF, JPG, or PNG of your receipt to begin.
              </p>
            </div>
          </>
        )}
      </div>

      {isProcessing && (
        <div className="mt-8 space-y-3">
          <div className="h-1.5 w-48 mx-auto bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 animate-progress origin-left w-full" />
          </div>
          <div className="flex justify-center gap-4 text-[10px] uppercase font-bold tracking-widest text-gray-400">
             <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> Scanning</span>
             <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> OCR</span>
             <span className="flex items-center gap-1 text-blue-600">Categorizing</span>
          </div>
        </div>
      )}
    </div>
  );
}
