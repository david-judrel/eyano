export interface ImageAttachment {
  mimeType: string;
  data: string; // base64 encoded
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: ImageAttachment[];
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  model?: string;
  attachments?: FileAttachment[];
}

export interface FileAttachment {
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  model: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
}

export type AIModel =
  | 'gnoxe-brains-1'
  | 'gnoxe-brains-1.5'
  | 'gnoxe-brains-2'
  | 'gnoxe-brains-code'
  | 'gnoxe-brains-vision';

export interface AIModelInfo {
  id: AIModel;
  name: string;
  description: string;
  maxTokens: number;
  available: boolean;
}

export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: Record<string, { inputTokens: number; outputTokens: number }>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: unknown;
}
