import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Sun,
  Moon,
  BrainCircuit,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { DocumentUpload } from '@/components/DocumentUpload';
import { DocumentList } from '@/components/DocumentList';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { EmptyState } from '@/components/EmptyState';
import { LoadingDots } from '@/components/LoadingDots';
import type { Document, ChatMessage as ChatMessageType, Source } from '@/types';
import { uploadFile, askQuestion, clearSession } from '@/lib/api';


function App() {
  const { theme, toggleTheme } = useTheme();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any in-flight streaming timer on unmount to prevent setState after unmount.
  useEffect(() => () => { if (streamingTimerRef.current) clearTimeout(streamingTimerRef.current); }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFilesSelected = useCallback(async (files: File[]) => {
    // Guard: prevent concurrent uploads racing over sessionId.
    if (isProcessing) return;

    const newDocs: Document[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: formatFileSize(file.size),
      type: file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.txt') ? 'txt' : 'docx',
      status: 'uploading' as const,
      progress: 0,
    }));

    setDocuments(prev => [...prev, ...newDocs]);
    setIsProcessing(true);

    // Read sessionId once at call time — stable for the duration of this upload batch.
    let currentSessionId = sessionId;
    let anyIndexed = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const doc = newDocs[i];

      setDocuments(prev => prev.map(d =>
        d.id === doc.id ? { ...d, status: 'processing', progress: 50 } : d
      ));

      try {
        const result = await uploadFile(file, currentSessionId ?? undefined);
        // Store session_id from first upload; reuse for subsequent files in this batch.
        if (!currentSessionId) {
          currentSessionId = result.session_id;
          setSessionId(result.session_id);
        }
        setDocuments(prev => prev.map(d =>
          d.id === doc.id ? { ...d, status: 'indexed', progress: 100 } : d
        ));
        anyIndexed = true;
      } catch (err) {
        console.error(`[upload] Failed to upload "${file.name}":`, err);
        setDocuments(prev => prev.map(d =>
          d.id === doc.id ? { ...d, status: 'error', progress: 0 } : d
        ));
      }
    }

    setIsProcessing(false);

    // Only show a message if at least one file was successfully indexed.
    if (anyIndexed) {
      setMessages(prev =>
        prev.length === 0
          ? [{
              id: crypto.randomUUID(),
              role: 'assistant',
              content: 'Your documents are ready! Ask me anything about their content — I\'ll provide answers with specific citations to the source material.',
              timestamp: new Date(),
            }]
          : [...prev, {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: 'New documents added to your session. You can now ask questions about all uploaded documents together.',
              timestamp: new Date(),
            }]
      );
    }
  }, [sessionId, isProcessing]);

  const handleRemoveDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (documents.length <= 1) {
      setMessages([]);
    }
  }, [documents.length]);

  const handleSendMessage = useCallback(async (text: string) => {
    if (!sessionId) return;

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      const { answer } = await askQuestion(text, sessionId);

      // Extract unique source filenames from inline [Source: filename] tags.
      const uniqueFilenames = [...new Map(
        [...answer.matchAll(/\[Source:\s*([^\]]+)\]/g)].map(m => [m[1].trim(), m[1].trim()])
      ).values()];
      const sources: Source[] = uniqueFilenames.map((name, i) => ({
        id: String(i),
        documentId: name,
        documentName: name,
        excerpt: '',
        relevance: 1,
      }));

      const msgId = crypto.randomUUID();
      setMessages(prev => [...prev, {
        id: msgId,
        role: 'assistant',
        content: answer,
        sources,
        timestamp: new Date(),
        isStreaming: true,
      }]);

      // Keep isGenerating true until streaming finishes so the input stays disabled.
      if (streamingTimerRef.current) clearTimeout(streamingTimerRef.current);
      streamingTimerRef.current = setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isStreaming: false } : m));
        setIsGenerating(false);
      }, answer.length * 12 + 500);

    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${detail}`,
        timestamp: new Date(),
      }]);
      setIsGenerating(false);
    }
  }, [sessionId]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSendMessage(suggestion);
  }, [handleSendMessage]);

  const handleStartOver = useCallback(async () => {
    if (isProcessing || isGenerating) return;
    if (sessionId) {
      try {
        await clearSession(sessionId);
      } catch (err) {
        // Session will expire on its own via the 15-min TTL — safe to ignore.
        console.error('[session] Failed to clear session:', err);
      }
    }
    if (streamingTimerRef.current) clearTimeout(streamingTimerRef.current);
    setSessionId(null);
    setDocuments([]);
    setMessages([]);
    setIsGenerating(false);
    setIsProcessing(false);
  }, [sessionId, isProcessing, isGenerating]);

  const hasDocuments = documents.length > 0;
  const indexedCount = documents.filter(d => d.status === 'indexed').length;

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Left Panel - Document Zone */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarOpen ? 380 : 0,
          opacity: sidebarOpen ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`
          fixed lg:relative z-50 h-full flex-shrink-0 overflow-hidden
          bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800
          flex flex-col
        `}
        style={{ width: sidebarOpen ? 380 : 0 }}
      >
        <div className="w-[380px] flex flex-col h-full flex-shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
                <BrainCircuit className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                  DocuMind AI
                </h1>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
                  Research Assistant
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Document Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Upload Zone */}
            <DocumentUpload
              onFilesSelected={handleFilesSelected}
              disabled={isProcessing}
            />

            {/* Document List */}
            <DocumentList
              documents={documents}
              onRemove={handleRemoveDocument}
            />

            {/* Processing indicator */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900"
                >
                  <Loader2 className="h-4 w-4 text-violet-600 dark:text-violet-400 animate-spin" />
                  <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                    AI is processing your documents...
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  {indexedCount} document{indexedCount !== 1 ? 's' : ''} indexed
                </span>
              </div>
              {sessionId ? (
                <button
                  onClick={handleStartOver}
                  disabled={isProcessing || isGenerating}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Clear all documents and start a new session"
                >
                  <RotateCcw className="h-3 w-3" />
                  Start over
                </button>
              ) : (
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">v1.0.0</span>
              )}
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Right Panel - Chat Zone */}
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Chat
              </span>
              {hasDocuments && (
                <span className="text-xs text-zinc-500 dark:text-zinc-500">
                  ({documents.length} document{documents.length !== 1 ? 's' : ''})
                </span>
              )}
            </div>
          </div>

          {/* Theme toggle for mobile (when sidebar is closed) */}
          <button
            onClick={toggleTheme}
            className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState
              hasDocuments={hasDocuments}
              onSuggestionClick={handleSuggestionClick}
            />
          ) : (
            <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6 space-y-6">
              <AnimatePresence>
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              </AnimatePresence>

              {isGenerating && <LoadingDots />}

              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <ChatInput
          onSubmit={handleSendMessage}
          isLoading={isGenerating}
          disabled={!hasDocuments}
        />
      </main>
    </div>
  );
}

export default App;
