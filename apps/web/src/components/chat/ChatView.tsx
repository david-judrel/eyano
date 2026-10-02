'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Check, Pencil, Sparkles, X } from 'lucide-react';
import { EmptyChat } from './EmptyChat';
import { Composer } from './Composer';
import { ChatMessage } from './Message';
import { ActivityStep } from '@/components/ai/ActivityStep';
import { IconButton } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';

/** Titre de la conversation, renommable sur place. */
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
    <div className="flex h-12 items-center gap-1">
      {isEditing ? (
        <>
          <input
            aria-label="Titre de la conversation"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-label text-foreground"
            autoFocus
          />
          <IconButton label="Valider" icon={Check} size="sm" tooltip={false} onClick={handleSave} />
          <IconButton label="Annuler" icon={X} size="sm" tooltip={false} onClick={() => setIsEditing(false)} />
        </>
      ) : (
        <div className="group flex min-w-0 items-center gap-1">
          <h2 className="truncate text-label text-foreground-secondary">{conversation.title || 'Nouvelle conversation'}</h2>
          <IconButton
            label="Renommer la conversation"
            icon={Pencil}
            size="sm"
            className="lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover:opacity-100"
            onClick={() => {
              setEditTitle(conversation.title || '');
              setIsEditing(true);
            }}
          />
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
      if (!isStreaming) {
        setMessages([]);
        api.getMessages(activeConversationId)
          .then(setMessages)
          .catch(() => {});
      }
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
        onImagePending: () => {
          const msgId = useAppStore.getState().streamingMessageId;
          if (msgId) useAppStore.getState().updateMessage(msgId, { imagePending: true });
        },

        onImage: (attachment) => {
          const msgId = useAppStore.getState().streamingMessageId;
          if (!msgId) return;
          const target = useAppStore.getState().messages.find((m) => m.id === msgId);
          useAppStore.getState().updateMessage(msgId, {
            imagePending: false,
            attachments: [...(target?.attachments || []), { ...attachment, storageKey: 'db:kepler' }],
          });
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
          const pendingId = useAppStore.getState().streamingMessageId;
          if (pendingId) useAppStore.getState().updateMessage(pendingId, { imagePending: false });
          setIsStreaming(false);
          setStreamingContent('');
          setStreamingMessageId(null);
        },
        onError: (error) => {
          const pendingId = useAppStore.getState().streamingMessageId;
          if (pendingId) useAppStore.getState().updateMessage(pendingId, { imagePending: false });
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
      const pendingId = useAppStore.getState().streamingMessageId;
      if (pendingId) useAppStore.getState().updateMessage(pendingId, { imagePending: false });
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingMessageId(null);
    }
  }, [activeConversationId, isStreaming, messages, selectedModel, user]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {activeConversationId && (
        <div className="shrink-0 border-b border-border-subtle bg-background">
          <div className="mx-auto max-w-content px-4 sm:px-6">
            <ConversationHeader />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        {activeConversationId ? (
          <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-8 sm:px-6">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                isStreaming={msg.id === streamingMessageId && isStreaming}
                onRetry={msg.status === 'FAILED' ? () => handleRetry(msg.id) : undefined}
              />
            ))}
            {isStreaming && !streamingMessageId && <ActivityStep icon={Sparkles} label="Eyano réfléchit…" status="running" />}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <EmptyChat />
        )}
      </div>

      <div className="safe-bottom shrink-0 bg-background px-4 pb-3 pt-2 sm:px-6">
        <div className="mx-auto w-full min-w-0 max-w-content">
          <Composer onRequireLogin={onRequireLogin} />
        </div>
      </div>
    </div>
  );
}
