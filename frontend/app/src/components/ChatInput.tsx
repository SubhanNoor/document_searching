import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = 'Ask a question about your documents...',
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120); // max 4 rows
      textarea.style.height = `${newHeight}px`;
    }
  }, [text]);

  const handleSubmit = () => {
    if (text.trim() && !isLoading && !disabled) {
      onSubmit(text.trim());
      setText('');
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl px-4 py-3"
    >
      <div className="flex items-end gap-3 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            rows={1}
            className={`
              w-full resize-none rounded-xl border bg-zinc-50 dark:bg-zinc-900
              px-4 py-3 pr-4 text-sm text-zinc-900 dark:text-zinc-100
              placeholder:text-zinc-400 dark:placeholder:text-zinc-600
              focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              ${disabled ? 'border-zinc-200 dark:border-zinc-800' : 'border-zinc-200 dark:border-zinc-700'}
            `}
            placeholder={disabled ? 'Upload documents to start asking questions' : placeholder}
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSubmit}
          disabled={!text.trim() || isLoading || disabled}
          className={`
            flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center
            transition-all duration-200
            ${text.trim() && !isLoading && !disabled
              ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-glow hover:shadow-lg'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600'
            }
            disabled:cursor-not-allowed
          `}
        >
          {isLoading ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <Send className="h-4.5 w-4.5" />
          )}
        </motion.button>
      </div>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-600 text-center mt-2">
        AI may produce inaccurate information. Always verify important details.
      </p>
    </motion.div>
  );
};
