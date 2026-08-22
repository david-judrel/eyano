import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role?: string;
  status?: string;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  title: string | null;
  model: string | null;
  provider?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
  messages?: { content: string }[];
}

export interface MessageAttachment {
  fileName: string;
  mimeType: string;
  size: number;
  url?: string;
}

export interface ImageAttachment {
  mimeType: string;
  data: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  provider?: string;
  status?: 'PENDING' | 'STREAMING' | 'COMPLETED' | 'FAILED';
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  createdAt: string;
  isStreaming?: boolean;
  attachments?: MessageAttachment[];
  images?: ImageAttachment[];
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;

  authInitialized: boolean;
  setAuthInitialized: (init: boolean) => void;

  conversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, data: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;

  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  messages: Message[];
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, data: Partial<Message>) => void;

  isStreaming: boolean;
  setIsStreaming: (isStreaming: boolean) => void;

  streamingMessageId: string | null;
  setStreamingMessageId: (id: string | null) => void;

  streamingContent: string;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;

  selectedModel: string;
  setSelectedModel: (model: string) => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  input: string;
  setInput: (input: string) => void;

  pendingGuestMessage: string | null;
  setPendingGuestMessage: (msg: string | null) => void;

  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  authInitialized: false,
  setAuthInitialized: (init) => set({ authInitialized: init }),

  conversations: [],
  setConversations: (conversations) => set({ conversations }),
  addConversation: (conversation) =>
    set((state) => ({ conversations: [conversation, ...state.conversations] })),
  updateConversation: (id, data) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...data } : c
      ),
    })),
  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId:
        state.activeConversationId === id ? null : state.activeConversationId,
    })),

  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, data) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...data } : m
      ),
    })),

  isStreaming: false,
  setIsStreaming: (isStreaming) => set({ isStreaming }),

  streamingMessageId: null,
  setStreamingMessageId: (id) => set({ streamingMessageId: id }),

  streamingContent: '',
  setStreamingContent: (content) => set({ streamingContent: content }),
  appendStreamingContent: (chunk) =>
    set((state) => ({ streamingContent: state.streamingContent + chunk })),

  selectedModel: 'gnoxe-brains-1',
  setSelectedModel: (model) => set({ selectedModel: model }),

  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  input: '',
  setInput: (input) => set({ input }),

  pendingGuestMessage: null,
  setPendingGuestMessage: (msg) => set({ pendingGuestMessage: msg }),

  theme: 'dark',
  setTheme: (theme) => set({ theme }),
}));
