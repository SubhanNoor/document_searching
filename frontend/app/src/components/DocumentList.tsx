import React from 'react';
import { FileText, X, CheckCircle2, Loader2, AlertCircle, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Document } from '@/types';

interface DocumentListProps {
  documents: Document[];
  onRemove: (id: string) => void;
}

const statusConfig = {
  uploading: {
    icon: Loader2,
    text: 'Uploading',
    className: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
    animate: 'animate-spin',
  },
  processing: {
    icon: Loader2,
    text: 'Processing',
    className: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30',
    animate: 'animate-spin',
  },
  indexed: {
    icon: CheckCircle2,
    text: 'Indexed',
    className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
    animate: '',
  },
  error: {
    icon: AlertCircle,
    text: 'Error',
    className: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
    animate: '',
  },
};

const getFileIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return <FileText className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
};

export const DocumentList: React.FC<DocumentListProps> = ({ documents, onRemove }) => {
  if (documents.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-500 uppercase tracking-wider px-1">
        Uploaded Documents ({documents.length})
      </p>
      <AnimatePresence mode="popLayout">
        {documents.map((doc) => {
          const status = statusConfig[doc.status];
          const StatusIcon = status.icon;

          return (
            <motion.div
              key={doc.id}
              layout
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="group relative flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              {/* File icon */}
              <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                {getFileIcon(doc.type)}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {doc.name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 font-mono">
                  {doc.size}
                </p>
              </div>

              {/* Status badge */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
                <StatusIcon className={`h-3.5 w-3.5 ${status.animate}`} />
                <span>{status.text}</span>
              </div>

              {/* Remove button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(doc.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Progress bar for uploading */}
              {doc.status === 'uploading' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-b-xl overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                    initial={{ width: '0%' }}
                    animate={{ width: `${doc.progress || 0}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
