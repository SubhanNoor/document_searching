import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileText, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage as ChatMessageType, Source } from '@/types';
import { useTypewriter } from '@/hooks/useTypewriter';

interface ChatMessageProps {
  message: ChatMessageType;
}

const SourcePill: React.FC<{ source: Source; index: number }> = ({ source, index }) => (
  <span className="source-pill ml-1" title={`${source.documentName}${source.page ? `, Page ${source.page}` : ''}`}>
    <FileText className="h-2.5 w-2.5" />
    <span>[{index + 1}] {source.documentName}</span>
  </span>
);

const SourcesSection: React.FC<{ sources: Source[] }> = ({ sources }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
      >
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
        <span>{isExpanded ? 'Hide sources' : `View sources (${sources.length})`}</span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              {sources.map((source, i) => (
                <motion.div
                  key={source.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {source.documentName}
                      </span>
                      {source.page && (
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-500 font-mono">
                          p.{source.page}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400">
                      {(source.relevance * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {source.excerpt}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StreamingText: React.FC<{ text: string; sources: Source[]; isStreaming: boolean }> = ({
  text,
  sources,
  isStreaming,
}) => {
  const { displayedText, isComplete } = useTypewriter({
    text,
    speed: 10,
    delay: 150,
  });

  // Parse text to insert source pills inline
  const renderContent = (content: string) => {
    // Simple approach: render text and append source pills at the end
    // For inline citations, we'd need a more sophisticated parser
    return (
      <>
        <span dangerouslySetInnerHTML={{ __html: formatMarkdown(content) }} />
        {sources.length > 0 && (
          <span className="inline-flex flex-wrap gap-1 mt-1">
            {sources.map((source, i) => (
              <SourcePill key={source.id} source={source} index={i} />
            ))}
          </span>
        )}
      </>
    );
  };

  const displayContent = isStreaming ? displayedText : text;

  return (
    <>
      <div className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
        {renderContent(displayContent)}
        {isStreaming && !isComplete && (
          <span className="inline-block w-[2px] h-4 bg-violet-500 animate-typing-cursor ml-0.5 align-middle" />
        )}
      </div>
      {(!isStreaming || isComplete) && sources.length > 0 && (
        <SourcesSection sources={sources} />
      )}
    </>
  );
};

// Simple markdown formatter
function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-xs font-mono">$1</code>')
    .replace(/\n/g, '<br/>');
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message.isStreaming && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [message.content, message.isStreaming]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex gap-3 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-gradient-to-br from-violet-600 to-indigo-600'
            : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700'
        }`}>
          {isUser ? (
            <span className="text-xs font-semibold text-white">You</span>
          ) : (
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          )}
        </div>

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-soft'
              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs'
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed">{message.content}</p>
          ) : (
            <StreamingText
              text={message.content}
              sources={message.sources || []}
              isStreaming={!!message.isStreaming}
            />
          )}
        </div>
      </div>
      <div ref={scrollRef} />
    </motion.div>
  );
};
