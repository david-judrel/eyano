const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface StreamEvent {
  type: 'start' | 'message_created' | 'text' | 'done' | 'error';
  content?: string;
  messageId?: string;
  title?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  code?: string;
  errorMessage?: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('eyano_token', token);
    } else {
      localStorage.removeItem('eyano_token');
    }
  }

  getToken(): string | null {
    if (typeof window === 'undefined') return this.token;
    return this.token || localStorage.getItem('eyano_token');
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Erreur reseau' }));
      throw new Error(error.message || `Erreur ${res.status}`);
    }

    return res.json();
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async chatStream(
    conversationId: string,
    message: string,
    model?: string,
    images?: { mimeType: string; data: string }[],
    callbacks?: {
      onStart?: (data: { messageId: string }) => void;
      onMessageCreated?: (data: { messageId: string }) => void;
      onChunk?: (chunk: { content: string }) => void;
      onDone?: (data: {
        messageId: string;
        title?: string | null;
        inputTokens?: number;
        outputTokens?: number;
      }) => void;
      onError?: (error: { code?: string; message: string }) => void;
    }
  ): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/ai/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversationId, message, model, images }),
    });

    if (!res.ok) {
      callbacks?.onError?.({ message: 'Erreur lors de la connexion' });
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const event: StreamEvent = JSON.parse(data);
            switch (event.type) {
              case 'start':
                callbacks?.onStart?.({ messageId: event.messageId || '' });
                break;
              case 'message_created':
                callbacks?.onMessageCreated?.({ messageId: event.messageId || '' });
                break;
              case 'text':
                callbacks?.onChunk?.({ content: event.content || '' });
                break;
              case 'done':
                callbacks?.onDone?.({
                  messageId: event.messageId || '',
                  title: event.title,
                  inputTokens: event.inputTokens,
                  outputTokens: event.outputTokens,
                });
                break;
              case 'error':
                callbacks?.onError?.({
                  code: event.code,
                  message: event.errorMessage || 'Erreur inconnue',
                });
                break;
            }
          } catch {}
        }
      }
    }
  }

  register(data: { email: string; password: string; name: string }) {
    return this.post<{ user: any; token: string }>('/auth/register', data);
  }

  login(data: { email: string; password: string }) {
    return this.post<{ user: any; token: string }>('/auth/login', data);
  }

  getMe() {
    return this.get<any>('/auth/me');
  }

  getConversations() {
    return this.get<any[]>('/conversations');
  }

  createConversation(title?: string) {
    return this.post<any>('/conversations', { title });
  }

  getConversation(id: string) {
    return this.get<any>(`/conversations/${id}`);
  }

  updateConversation(id: string, data: { title?: string; archived?: boolean }) {
    return this.patch<any>(`/conversations/${id}`, data);
  }

  deleteConversation(id: string) {
    return this.delete<any>(`/conversations/${id}`);
  }

  getMessages(conversationId: string) {
    return this.get<any[]>(`/conversations/${conversationId}/messages`);
  }

  getUsage() {
    return this.get<any>('/usage');
  }
}

export const api = new ApiClient();
