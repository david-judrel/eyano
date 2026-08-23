'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { EmptyChat } from './EmptyChat';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { Pencil, Check, X } from 'lucide-react';

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-slide-up">
      <div className="shrink-0 mt-1">
        <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/15%] flex items-center justify-center overflow-hidden animate-pulse-subtle">
          <img src="/icon.png" alt="Eyano" className="h-5 w-5 object-contain" />
        </div>
      </div>
      <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl rounded-bl-md bg-surface-2 border border-border">
        <div className="flex items-center gap-1.5">
          <span className="w-[6px] h-[6px] rounded-full bg-brand/60 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-[6px] h-[6px] rounded-full bg-brand/60 animate-bounce" style={{ animationDelay: '200ms' }} />
          <span className="w-[6px] h-[6px] rounded-full bg-brand/60 animate-bounce" style={{ animationDelay: '400ms' }} />
        </div>
        <span className="text-[13px] text-brand animate-pulse-subtle">Eyano reflechit...</span>
      </div>
    </div>
  );
}

function ConversationHeader() {
  const { activeConversationId, conversations, updateConversation } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const conversation = conversations.find((c) => c.id === activeConversationId);

  if (!conversation) return null;

  const handleSave = async () => {
    if (editTitle.trim() && editTitle !== conversation.title) {
      await api.updateConversation(activeConversationId!, { title: editTitle.trim() });
      updateConversation(activeConversationId!, { title: editTitle.trim() });
    }
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-2 py-2">
      {isEditing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
            className="bg-transparent border-b border-brand/40 text-foreground text-sm font-medium focus:outline-none px-1 py-0.5 min-w-[200px]"
            autoFocus
          />
          <button onClick={handleSave} className="p-1 text-brand hover:bg-brand/10 rounded">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={() => setIsEditing(false)} className="p-1 text-foreground/30 hover:text-foreground hover:bg-foreground/10 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <h2 className="text-sm font-medium text-foreground/60 truncate max-w-[300px]">
            {conversation.title || 'Nouvelle conversation'}
          </h2>
          <button
            onClick={() => { setEditTitle(conversation.title || ''); setIsEditing(true); }}
            className="p-1 text-foreground/20 hover:text-foreground/50 opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-surface-2"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

interface ChatViewProps {
  onRequireLogin?: (message: string) => void;
}

export function ChatView({ onRequireLogin }: ChatViewProps) {
  const {
    activeConversationId, messages, setMessages, addMessage,
    streamingContent, isStreaming, setIsStreaming, setStreamingContent,
    streamingMessageId, setStreamingMessageId,
    conversations, updateConversation, selectedModel, user,
  } = useAppStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevConversationId = useRef<string | null>(null);

  useEffect(() => {
    if (activeConversationId && activeConversationId !== prevConversationId.current) {
      setMessages([]);
      api.getMessages(activeConversationId)
        .then(setMessages)
        .catch(() => {});
      prevConversationId.current = activeConversationId;
    } else if (!activeConversationId) {
      setMessages([]);
      prevConversationId.current = null;
    }
  }, [activeConversationId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, streamingContent, isStreaming]);

  useEffect(() => {
    if (activeConversationId) {
      const convo = conversations.find((c) => c.id === activeConversationId);
      document.title = convo?.title ? `${convo.title} | Eyano` : 'Eyano';
    } else {
      document.title = 'Eyano - AI Assistant';
    }
  }, [activeConversationId, conversations]);

  const handleRetry = useCallback(async (failedMessageId: string) => {
    if (!activeConversationId || isStreaming || !user) return;

    const failedMsg = messages.find((m) => m.id === failedMessageId);
    if (!failedMsg) return;

    const userMsgIndex = messages.findIndex((m) => m.id === failedMessageId) - 1;
    const userMsg = messages[userMsgIndex];
    if (!userMsg || userMsg.role !== 'user') return;

    setMessages(messages.filter((m) => m.id !== failedMessageId));

    setIsStreaming(true);
    setStreamingContent('');

    try {
      await api.chatStream(activeConversationId, userMsg.content, selectedModel, undefined, {
        onStart: () => {},
        onMessageCreated: (data) => {
          setStreamingMessageId(data.messageId);
          addMessage({
            id: data.messageId,
            role: 'assistant',
            content: '',
            model: selectedModel,
            status: 'STREAMING',
            createdAt: new Date().toISOString(),
          });
        },
        onChunk: (chunk) => {
          setStreamingContent((useAppStore.getState().streamingContent || '') + chunk.content);
          const msgId = useAppStore.getState().streamingMessageId;
          if (msgId) {
            updateConversation(activeConversationId, {});
          }
        },
        onDone: (data) => {
          const msgId = useAppStore.getState().streamingMessageId;
          if (msgId) {
            const { messages: currentMessages } = useAppStore.getState();
            const streamingMsg = currentMessages.find((m) => m.id === msgId);
            if (streamingMsg) {
              const { updateMessage } = useAppStore.getState();
              updateMessage(msgId, {
                content: streamingMsg.content,
                status: 'COMPLETED',
                inputTokens: data.inputTokens,
                outputTokens: data.outputTokens,
              });
            }
          }
          setIsStreaming(false);
          setStreamingContent('');
          setStreamingMessageId(null);
        },
        onError: (error) => {
          setIsStreaming(false);
          setStreamingContent('');
          setStreamingMessageId(null);
          addMessage({
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: error.message,
            status: 'FAILED',
            createdAt: new Date().toISOString(),
          });
        },
      });
    } catch {
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingMessageId(null);
    }
  }, [activeConversationId, isStreaming, messages, selectedModel, user]);

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      {activeConversationId && (
        <div className="shrink-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 lg:px-6">
          <div className="max-w-[800px] mx-auto">
            <ConversationHeader />
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {activeConversationId ? (
          <div className="max-w-[800px] mx-auto px-4 lg:px-6 py-6 space-y-6">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={msg.id === streamingMessageId && isStreaming}
                onRetry={msg.status === 'FAILED' ? () => handleRetry(msg.id) : undefined}
              />
            ))}
            {isStreaming && !streamingMessageId && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <EmptyChat />
        )}
      </div>

      <div className="shrink-0 z-30 w-full bg-gradient-to-t from-background via-background/95 to-transparent pt-8 pb-4 px-4 safe-bottom">
        <div className="w-full min-w-0 max-w-[700px] mx-auto">
          <Composer onRequireLogin={onRequireLogin} />
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
