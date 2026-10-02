'use client';

import { useState } from 'react';
import { AlertCircle, Check, Copy, Pencil, RefreshCw } from 'lucide-react';
import type { Message } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button, IconButton } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ImageGenerationActivity } from '@/components/ai/ImageGenerationActivity';
import { Attachments } from './Attachments';
import { Markdown } from './Markdown';

/* ------------------------------------------------------------ actions */

function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
}

/** Actions d'un message : discretes, toujours nommees, sous le contenu. */
function MessageActions({ children, align = 'start' }: { children: React.ReactNode; align?: 'start' | 'end' }) {
  return (
    <div className={cn('flex items-center gap-0.5 text-foreground-muted', align === 'end' && 'justify-end')}>{children}</div>
  );
}

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/* -------------------------------------------------------------- props */

export interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onRetry?: () => void;
  onEdit?: (content: string) => void;
}

/* -------------------------------------------------------- utilisateur */

/** Message de l'utilisateur : a droite, bulle `surface`. */
export function UserMessage({ message, onEdit }: ChatMessageProps) {
  const { copied, copy } = useCopy(message.content);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const hasAttachments = Boolean(message.attachments?.length);

  return (
    <div className="group flex flex-col items-end gap-1 animate-slide-up">
      {hasAttachments && <Attachments attachments={message.attachments!} align="end" />}

      {isEditing ? (
        <div className="flex w-full max-w-[85%] flex-col gap-2">
          <Textarea aria-label="Modifier le message" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Annuler</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onEdit?.(draft);
                setIsEditing(false);
              }}
            >
              Enregistrer
            </Button>
          </div>
        </div>
      ) : message.content ? (
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-surface px-4 py-2 text-body-md text-foreground">
          {message.content}
        </div>
      ) : null}

      {!isEditing && (
        <MessageActions align="end">
          <span className="px-1 text-caption">{formatTime(message.createdAt)}</span>
          <IconButton
            label="Modifier"
            icon={Pencil}
            size="sm"
            className="lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover:opacity-100"
            onClick={() => {
              setDraft(message.content);
              setIsEditing(true);
            }}
          />
          <IconButton
            label={copied ? 'Copié' : 'Copier'}
            icon={copied ? Check : Copy}
            size="sm"
            className="lg:opacity-0 lg:focus-visible:opacity-100 lg:group-hover:opacity-100"
            onClick={copy}
          />
        </MessageActions>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- EYANO */

/** Message d'EYANO : sans bulle, la reponse occupe la colonne. */
export function AssistantMessage({ message, isStreaming = false, onRetry }: ChatMessageProps) {
  const { copied, copy } = useCopy(message.content);
  const isFailed = message.status === 'FAILED';
  const hasAttachments = Boolean(message.attachments?.length);

  if (isFailed) {
    return (
      <div role="alert" className="flex items-start gap-2 animate-slide-up">
        <AlertCircle className="icon-sm mt-1 text-error" aria-hidden />
        <div className="flex flex-col items-start gap-2">
          <p className="text-body-md text-foreground-secondary">{message.content}</p>
          {onRetry && (
            <Button variant="outline" size="sm" icon={RefreshCw} onClick={onRetry}>Réessayer</Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col gap-2 animate-slide-up">
      {(message.content || isStreaming) && (
        <div>
          <Markdown content={message.content} />
          {isStreaming && <StreamingCursor />}
        </div>
      )}

      {message.imagePending && <ImageGenerationActivity />}
      {hasAttachments && <Attachments attachments={message.attachments!} />}

      {!isStreaming && message.content && (
        <MessageActions>
          <IconButton label={copied ? 'Copié' : 'Copier'} icon={copied ? Check : Copy} size="sm" onClick={copy} />
          {message.latencyMs ? (
            <span className="px-1 text-caption">
              {Math.round(message.latencyMs / 1000)} s
              {message.inputTokens && message.outputTokens ? ` · ${message.inputTokens + message.outputTokens} tokens` : ''}
            </span>
          ) : null}
        </MessageActions>
      )}
    </div>
  );
}

/** Curseur de flux : le vert signale qu'EYANO ecrit. */
export function StreamingCursor() {
  return <span aria-hidden className="ml-0.5 inline-block h-4 w-0.5 animate-pulse-subtle rounded-full bg-brand align-text-bottom" />;
}

/** Aiguillage : un message, la bonne presentation. */
export function ChatMessage(props: ChatMessageProps) {
  return props.message.role === 'user' ? <UserMessage {...props} /> : <AssistantMessage {...props} />;
}
