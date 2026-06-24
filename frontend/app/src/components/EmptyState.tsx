import React from 'react';
import { FileSearch, Sparkles, FileText, MessageSquare, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  onSuggestionClick?: (suggestion: string) => void;
  hasDocuments?: boolean;
}

const suggestions = [
  { icon: FileText, text: 'Summarize key points' },
  { icon: MessageSquare, text: 'What are the main findings?' },
  { icon: Zap, text: 'Extract action items' },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onSuggestionClick, hasDocuments = false }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-md"
      >
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30">
          {hasDocuments ? (
            <Sparkles className="h-8 w-8 text-violet-600 dark:text-violet-400" />
          ) : (
            <FileSearch className="h-8 w-8 text-zinc-400 dark:text-zinc-600" />
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
          {hasDocuments ? 'Ready to analyze your documents' : 'Upload documents to get started'}
        </h3>

        {/* Description */}
        <p className="text-sm text-zinc-500 dark:text-zinc-500 mb-8 leading-relaxed">
          {hasDocuments
            ? 'Your AI research assistant has analyzed the content. Ask questions and get cited answers.'
            : 'Upload PDF, Word, or text files and ask questions. The AI will analyze the content and cite specific sources.'
          }
        </p>

        {/* Suggestion chips */}
        {hasDocuments && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
            className="flex flex-wrap justify-center gap-2"
          >
            {suggestions.map((suggestion, i) => {
              const Icon = suggestion.icon;
              return (
                <motion.button
                  key={suggestion.text}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1, duration: 0.3 }}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSuggestionClick?.(suggestion.text)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-700 dark:text-zinc-300 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-all duration-200 shadow-xs hover:shadow-soft"
                >
                  <Icon className="h-4 w-4 text-violet-500" />
                  <span>{suggestion.text}</span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
