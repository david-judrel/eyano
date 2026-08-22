'use client';

import { Copy, Check, ThumbsUp, ThumbsDown, Volume2, FileText, RefreshCw, AlertCircle, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Message, MessageAttachment } from '@/lib/store';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Logo } from './ui/logo';

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onRetry?: () => void;
  onEdit?: (content: string) => void;
}

function Attachments({ attachments }: { attachments: MessageAttachment[] }) {
  const images = attachments.filter((a) => a.mimeType.startsWith('image/'));
  const files = attachments.filter((a) => !a.mimeType.startsWith('image/'));

  return (
    <div className="flex flex-col gap-2 mb-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((att, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden border border-[#F2FFF0]/[8%] max-w-[240px]">
              {att.url ? (
                <img src={att.url} alt={att.fileName} className="w-full h-auto max-h-[200px] object-cover" />
              ) : (
                <div className="w-full h-32 bg-[#F2FFF0]/[4%] flex items-center justify-center">
                  <span className="text-xs text-[#F2FFF0]/30">{att.fileName}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((att, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F2FFF0]/[4%] border border-[#F2FFF0]/[6%]">
              <FileText className="h-3.5 w-3.5 text-[#F2FFF0]/40 shrink-0" />
              <span className="text-xs text-[#F2FFF0]/50 truncate max-w-[120px]">{att.fileName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageBubble({ message, isStreaming, onRetry, onEdit }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const isUser = message.role === 'user';
  const isFailed = message.status === 'FAILED';
  const hasAttachments = message.attachments && message.attachments.length > 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    onEdit?.(editContent);
    setIsEditing(false);
  };

  const time = new Date(message.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="flex items-end gap-2 max-w-[75%]">
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setEditContent(message.content); setIsEditing(true); }}
              className="p-1.5 rounded-lg transition-all duration-150 text-[#F2FFF0]/30 hover:text-[#F2FFF0]/60 hover:bg-[#F2FFF0]/[6%]"
              title="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg transition-all duration-150 text-[#F2FFF0]/30 hover:text-[#F2FFF0]/60 hover:bg-[#F2FFF0]/[6%]"
              title="Copier"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[#39FF14]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="text-[11px] text-[#F2FFF0]/20 whitespace-nowrap pb-1">{time}</div>
          <div className="rounded-2xl rounded-br-md border border-[#F2FFF0]/[6%] overflow-hidden bg-[#F2FFF0]/[6%]">
            {hasAttachments && (
              <div className="px-4 pt-3">
                <Attachments attachments={message.attachments!} />
              </div>
            )}
            {isEditing ? (
              <div className="p-3">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[80px] bg-[#050505] border border-[#39FF14]/30 rounded-xl p-3 text-sm text-[#F2FFF0] focus:outline-none focus:border-[#39FF14]/50 resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-xs text-[#F2FFF0]/40 hover:text-[#F2FFF0] transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 text-xs bg-[#39FF14] text-[#050505] rounded-lg font-medium hover:brightness-110 transition-all"
                  >
                    Sauvegarder
                  </button>
                </div>
              </div>
            ) : message.content ? (
              <div className="px-4 py-3 text-[14px] leading-relaxed text-[#F2FFF0]/90">
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-slide-up">
      <div className="shrink-0 mt-1">
        <div className="w-8 h-8 rounded-xl bg-[#39FF14]/10 border border-[#39FF14]/12%] flex items-center justify-center overflow-hidden">
          <Logo size="sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1 min-w-0 max-w-[85%]">
        <div className={cn('text-[14px] leading-relaxed', isFailed ? 'text-red-400/80' : 'text-[#F2FFF0]/80')}>
          {isStreaming ? (
            <div className="animate-fade-in">
              <MarkdownRenderer content={message.content} />
              <span className="inline-block w-[3px] h-4 ml-0.5 animate-pulse-subtle bg-[#39FF14] rounded-full align-text-bottom" />
            </div>
          ) : isFailed ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <span>{message.content}</span>
            </div>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        {!isStreaming && message.content && (
          <div className="flex items-center gap-0.5 mt-1">
            {isFailed && onRetry && (
              <button
                onClick={onRetry}
                className="p-1.5 rounded-lg transition-all duration-150 text-[#F2FFF0]/30 hover:text-[#39FF14] hover:bg-[#39FF14]/[10%]"
                title="Reessayer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            {!isFailed && (
              <>
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-lg transition-all duration-150 text-[#F2FFF0]/30 hover:text-[#F2FFF0]/60 hover:bg-[#F2FFF0]/[6%]"
                  title="Copier"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-[#39FF14]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <button className="p-1.5 rounded-lg transition-all duration-150 text-[#F2FFF0]/30 hover:text-[#F2FFF0]/60 hover:bg-[#F2FFF0]/[6%]" title="Utile">
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button className="p-1.5 rounded-lg transition-all duration-150 text-[#F2FFF0]/30 hover:text-[#F2FFF0]/60 hover:bg-[#F2FFF0]/[6%]" title="Pas utile">
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
                <button className="p-1.5 rounded-lg transition-all duration-150 text-[#F2FFF0]/30 hover:text-[#F2FFF0]/60 hover:bg-[#F2FFF0]/[6%]" title="Ecouter">
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}

        {!isStreaming && message.latencyMs && (
          <div className="text-[10px] text-[#F2FFF0]/15 mt-1">
            {Math.round(message.latencyMs / 1000)}s
            {message.inputTokens && message.outputTokens && (
              <span> - {message.inputTokens + message.outputTokens} tokens</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
