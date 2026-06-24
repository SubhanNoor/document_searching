import React, { useState, useRef, useCallback } from 'react';
import { CloudUpload, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onFilesSelected, disabled }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type === 'application/pdf' || f.type === 'application/msword' || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || f.type === 'text/plain'
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onFilesSelected(files);
    }
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative group cursor-pointer rounded-2xl border-2 border-dashed
          transition-all duration-200 ease-out
          ${isDragOver
            ? 'border-violet-500 bg-violet-50/80 dark:bg-violet-950/20 scale-[1.02] shadow-glow'
            : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt"
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />

        <AnimatePresence>
          {isDragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/5 to-indigo-500/5"
            />
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <motion.div
            animate={isDragOver ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`
              mb-4 flex h-14 w-14 items-center justify-center rounded-2xl
              ${isDragOver
                ? 'bg-gradient-to-br from-violet-500 to-indigo-600 shadow-glow'
                : 'bg-zinc-100 dark:bg-zinc-800'
              }
              transition-colors duration-200
            `}
          >
            {isDragOver ? (
              <FileText className="h-7 w-7 text-white" />
            ) : (
              <CloudUpload className="h-7 w-7 text-zinc-400 dark:text-zinc-500" />
            )}
          </motion.div>

          <p className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100 mb-1">
            {isDragOver ? 'Drop files here' : 'Drop your documents here'}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            or <span className="text-violet-600 dark:text-violet-400 font-medium">click to browse files</span>
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-3">
            PDF, DOCX, TXT — up to 50MB each
          </p>
        </div>
      </div>
    </motion.div>
  );
};
