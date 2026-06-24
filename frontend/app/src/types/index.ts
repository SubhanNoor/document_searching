export interface Document {
  id: string;
  name: string;
  size: string;
  type: 'pdf' | 'docx' | 'txt';
  status: 'uploading' | 'processing' | 'indexed' | 'error';
  progress?: number;
}

export interface Source {
  id: string;
  documentId: string;
  documentName: string;
  page?: number;
  section?: string;
  excerpt: string;
  relevance: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
  isStreaming?: boolean;
}

export interface AppState {
  documents: Document[];
  messages: ChatMessage[];
  isProcessing: boolean;
  isGenerating: boolean;
}
