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
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { DocumentUpload } from '@/components/DocumentUpload';
import { DocumentList } from '@/components/DocumentList';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { EmptyState } from '@/components/EmptyState';
import { LoadingDots } from '@/components/LoadingDots';
import type { Document, ChatMessage as ChatMessageType, Source } from '@/types';

// Demo content for initial load
const DEMO_ANSWER = `Based on the contract analysis, here are the **key findings**:

**1. Termination Clause**
The agreement allows either party to terminate with 30 days written notice. However, Section 4.2 specifies that immediate termination is permitted in cases of material breach.

**2. Payment Terms**
Net 30 payment terms apply to all invoices. Late payments incur a 1.5% monthly service charge as outlined in Section 7.3.

**3. Liability Cap**
The total liability is capped at the total amount paid in the 12 months preceding the claim, per Section 12.1.

**4. Data Handling**
All customer data must be processed in accordance with GDPR requirements (Section 15), with specific provisions for data deletion within 30 days of contract termination.

Would you like me to elaborate on any specific section?`;

const DEMO_SOURCES: Source[] = [
  {
    id: '1',
    documentId: 'doc1',
    documentName: 'Service_Agreement_2024.pdf',
    page: 4,
    excerpt: 'Either party may terminate this Agreement by providing thirty (30) days prior written notice to the other party. Notwithstanding the foregoing, either party may terminate this Agreement immediately upon written notice if the other party materially breaches...',
    relevance: 0.98,
  },
  {
    id: '2',
    documentId: 'doc1',
    documentName: 'Service_Agreement_2024.pdf',
    page: 7,
    excerpt: 'All fees are net thirty (30) days from the invoice date. Late payments shall be subject to a service charge of one and one-half percent (1.5%) per month on the outstanding balance...',
    relevance: 0.95,
  },
  {
    id: '3',
    documentId: 'doc1',
    documentName: 'Service_Agreement_2024.pdf',
    page: 12,
    excerpt: "Company's total aggregate liability arising out of or relating to this Agreement shall not exceed the total amount paid by Customer to Company in the twelve (12) months preceding the event giving rise to liability...",
    relevance: 0.92,
  },
];

function App() {
  const { theme, toggleTheme } = useTheme();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFilesSelected = useCallback((files: File[]) => {
    // Add files as uploading
    const newDocs: Document[] = files.map((file) => ({
      id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: file.name,
      size: formatFileSize(file.size),
      type: file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.txt') ? 'txt' : 'docx',
      status: 'uploading',
      progress: 0,
    }));

    setDocuments(prev => [...prev, ...newDocs]);
    setIsProcessing(true);

    // Simulate upload progress
    newDocs.forEach((doc, index) => {
      const interval = setInterval(() => {
        setDocuments(prev => prev.map(d => {
          if (d.id === doc.id) {
            const newProgress = Math.min((d.progress || 0) + 20, 100);
            return {
              ...d,
              progress: newProgress,
              status: newProgress >= 100 ? 'processing' : 'uploading',
            };
          }
          return d;
        }));
      }, 200);

      // Complete processing after delay
      setTimeout(() => {
        clearInterval(interval);
        setDocuments(prev => prev.map(d =>
          d.id === doc.id ? { ...d, status: 'indexed', progress: 100 } : d
        ));

        // If this is the last file, mark processing as done and add welcome message
        if (index === newDocs.length - 1) {
          setTimeout(() => {
            setIsProcessing(false);
            if (messages.length === 0) {
              setMessages([{
                id: `msg_${Date.now()}`,
                role: 'assistant',
                content: 'I\'ve analyzed your documents. Ask me anything about their content — I\'ll provide answers with specific citations to the source material.',
                timestamp: new Date(),
              }]);
            }
          }, 800);
        }
      }, 1500 + index * 300);
    });
  }, [messages.length]);

  const handleRemoveDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    if (documents.length <= 1) {
      setMessages([]);
    }
  }, [documents.length]);

  const handleSendMessage = useCallback((text: string) => {
    const userMessage: ChatMessageType = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: ChatMessageType = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: DEMO_ANSWER,
        sources: DEMO_SOURCES,
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsGenerating(false);

      // Mark streaming as complete after typewriter finishes
      setTimeout(() => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessage.id ? { ...m, isStreaming: false } : m
          )
        );
      }, DEMO_ANSWER.length * 12 + 500);
    }, 1200);
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSendMessage(suggestion);
  }, [handleSendMessage]);

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
          <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
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
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">
                v1.0.0
              </span>
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
        <div className="flex-1 overflow-y-auto scrollbar-thin">
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
