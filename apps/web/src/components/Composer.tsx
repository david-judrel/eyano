'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Send, ChevronDown, Plus, X, Image, FileText, Paperclip, StopCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { EYANO_MODELS } from '@/lib/models';
import { Logo } from './ui/logo';
import { useToast } from '@/lib/toast';

interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'file';
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_IMAGES = 4;
const MAX_FILES = 5;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(name: string) {
  if (name.endsWith('.pdf')) return 'PDF';
  if (name.match(/\.(txt|md)$/)) return 'TXT';
  if (name.endsWith('.csv')) return 'CSV';
  if (name.endsWith('.json')) return 'JSON';
  if (name.match(/\.xlsx?$/)) return 'XLS';
  if (name.match(/\.docx?$/)) return 'DOC';
  return 'FILE';
}

function fileToBase64(file: File): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve({ mimeType: file.type, data: base64 });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ComposerProps {
  onRequireLogin?: (message: string) => void;
}

export function Composer({ onRequireLogin }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const {
    input, setInput, activeConversationId, setActiveConversationId,
    addMessage, updateMessage, isStreaming, setIsStreaming,
    streamingMessageId, setStreamingMessageId,
    streamingContent, setStreamingContent, appendStreamingContent,
    selectedModel, setSelectedModel,
    user, addConversation, updateConversation,
    pendingGuestMessage, setPendingGuestMessage,
  } = useAppStore();

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (pendingGuestMessage && user && !isStreaming) {
      setInput(pendingGuestMessage);
      setPendingGuestMessage(null);
      setTimeout(() => {
        handleSubmit();
      }, 100);
    }
  }, [pendingGuestMessage, user]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validateAndAddFiles = useCallback((fileList: FileList | File[]) => {
    const current = attachedFiles;
    const newFiles: AttachedFile[] = [];
    let imageCount = current.filter((f) => f.type === 'image').length;
    let fileCount = current.length;

    for (const f of Array.from(fileList)) {
      if (fileCount >= MAX_FILES) {
        addToast(`Maximum ${MAX_FILES} fichiers par message`, 'warning');
        break;
      }
      const isImage = IMAGE_TYPES.includes(f.type);
      if (isImage) {
        if (imageCount >= MAX_IMAGES) {
          addToast(`Maximum ${MAX_IMAGES} images par message`, 'warning');
          continue;
        }
        if (f.size > MAX_IMAGE_SIZE) {
          addToast(`${f.name} depasse ${formatSize(MAX_IMAGE_SIZE)}`, 'error');
          continue;
        }
        imageCount++;
      } else {
        if (f.size > MAX_FILE_SIZE) {
          addToast(`${f.name} depasse ${formatSize(MAX_FILE_SIZE)}`, 'error');
          continue;
        }
      }
      newFiles.push({
        file: f,
        type: isImage ? 'image' : 'file',
        preview: isImage ? URL.createObjectURL(f) : undefined,
      });
      fileCount++;
    }
    if (newFiles.length > 0) setAttachedFiles((prev) => [...prev, ...newFiles]);
  }, [attachedFiles, addToast]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      validateAndAddFiles(files);
    }
  }, [validateAndAddFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) validateAndAddFiles(e.dataTransfer.files);
  }, [validateAndAddFiles]);

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent('');
    setStreamingMessageId(null);
  };

  const handleSubmit = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isStreaming) return;

    if (!user) {
      onRequireLogin?.(input.trim());
      return;
    }

    let message = input.trim();
    if (!message && attachedFiles.length > 0) {
      const names = attachedFiles.map((f) => f.file.name).join(', ');
      message = attachedFiles.length === 1 ? `Piece jointe : ${names}` : `${attachedFiles.length} pieces jointes : ${names}`;
    }
    setInput('');
    setDropdownOpen(false);

    let convId = activeConversationId;
    if (!convId) {
      const conv = await api.createConversation();
      convId = conv.id;
      setActiveConversationId(conv.id);
      addConversation(conv);
      router.push(`/c/${conv.id}`);
    }

    const finalConvId = convId!;

    const tempUserMsgId = `temp-user-${Date.now()}`;
    addMessage({
      id: tempUserMsgId,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
      attachments: attachedFiles.map(af => ({
        fileName: af.file.name,
        mimeType: af.file.type,
        size: af.file.size,
        url: af.preview,
      })),
    });

    const images: { mimeType: string; data: string }[] = [];
    for (const af of attachedFiles) {
      if (af.type === 'image' && af.file) {
        const img = await fileToBase64(af.file);
        images.push(img);
      }
    }

    setIsStreaming(true);
    setStreamingContent('');
    const filesToSend = [...attachedFiles];
    setAttachedFiles([]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    let currentMessageId = '';

    try {
      await api.chatStream(finalConvId, message, selectedModel, images.length > 0 ? images : undefined, {
        onStart: () => {},
        onMessageCreated: (data) => {
          currentMessageId = data.messageId;
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
          appendStreamingContent(chunk.content);
          if (currentMessageId) {
            updateMessage(currentMessageId, {
              content: (useAppStore.getState().messages.find(m => m.id === currentMessageId)?.content || '') + chunk.content,
            });
          }
        },
        onDone: (data) => {
          if (currentMessageId) {
            updateMessage(currentMessageId, {
              content: data.messageId ? useAppStore.getState().messages.find(m => m.id === currentMessageId)?.content || '' : '',
              status: 'COMPLETED',
              inputTokens: data.inputTokens,
              outputTokens: data.outputTokens,
            });
          }
          if (data.title) {
            updateConversation(finalConvId, { title: data.title });
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

    filesToSend.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
  };

  const canSend = (input.trim() || attachedFiles.length > 0) && !isStreaming;

  return (
    <div className="w-full min-w-0 pb-2 pt-1 relative">
      {isDragging && (
        <div className="absolute inset-x-0 bottom-0 top-[-100px] z-50 flex flex-col items-center justify-center bg-[#050505]/90 backdrop-blur-md rounded-3xl border-2 border-dashed border-[#39FF14]/50 animate-in fade-in"
          onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onDragLeave={() => setIsDragging(false)}>
          <div className="p-4 rounded-full bg-[#39FF14]/10 mb-3"><Paperclip className="h-8 w-8 text-[#39FF14]" /></div>
          <span className="text-lg font-semibold text-[#F2FFF0]">Deposez vos fichiers ici</span>
        </div>
      )}

      <div ref={dropdownRef} className="relative w-full">
        <div
          className={cn(
            'relative flex flex-col rounded-[2rem] transition-all duration-300 w-full min-w-0 overflow-hidden',
            'border backdrop-blur-xl',
            attachedFiles.length > 0
              ? 'bg-[#0D0F0E]/95 border-[#39FF14]/30 shadow-[0_0_25px_rgba(57,255,20,0.08)]'
              : isDragging
                ? 'border-[#39FF14]/40 bg-[#0D0F0E]/90 shadow-[0_0_30px_rgba(57,255,20,0.1)]'
                : canSend
                  ? 'border-[#39FF14]/20 bg-[#0D0F0E]/80 shadow-[0_0_15px_rgba(57,255,20,0.05)]'
                  : 'border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 hover:border-[#F2FFF0]/[10%]'
          )}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
        >
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-4 pb-2 animate-in slide-in-from-top-2 duration-300">
              {attachedFiles.map((af, i) => (
                <div key={i} className="relative group/file shrink-0">
                  {af.type === 'image' && af.preview ? (
                    <div className="w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] rounded-xl overflow-hidden border border-[#F2FFF0]/[8%] bg-[#050505]">
                      <img src={af.preview} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] rounded-xl border border-[#F2FFF0]/[8%] bg-[#050505] flex flex-col items-center justify-center gap-1.5 p-2">
                      <div className="w-8 h-8 rounded-lg bg-[#39FF14]/[10%] border border-[#39FF14]/20 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-[#39FF14]">{getFileIcon(af.file.name)}</span>
                      </div>
                      <span className="text-[9px] text-[#F2FFF0]/50 font-medium truncate w-full text-center px-1">{af.file.name}</span>
                    </div>
                  )}
                  <button onClick={() => removeFile(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#F2FFF0]/[10%] flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-all hover:bg-red-500/20 hover:border-red-500/40 z-10">
                    <X className="h-3 w-3 text-[#F2FFF0]/60" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 px-3 py-3">
            <div className="shrink-0 mb-1">
              <button onClick={() => setDropdownOpen(!dropdownOpen)}
                className={cn('p-2.5 rounded-full transition-all duration-200',
                  dropdownOpen ? 'text-[#39FF14] bg-[#39FF14]/[10%] rotate-45' : 'text-[#F2FFF0]/30 hover:text-[#39FF14] hover:bg-[#39FF14]/[5%]')}>
                <Plus className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 min-w-0 relative">
              <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                onPaste={handlePaste}
                placeholder={attachedFiles.length > 0 ? `Ajouter un message...` : 'Posez votre question a Eyano...'}
                rows={1}
                className="w-full min-w-0 bg-transparent resize-none text-[15px] leading-relaxed py-2.5 pr-2 text-[#F2FFF0]/90 placeholder:text-[#F2FFF0]/25 focus:outline-none focus:ring-0 overflow-y-auto overflow-x-hidden break-words whitespace-pre-wrap scrollbar-hide"
                style={{ maxHeight: '200px' }} />
            </div>

            <div className="relative shrink-0 group mb-1 hidden sm:block">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#F2FFF0]/30 cursor-pointer hover:text-[#F2FFF0]/60 transition-colors whitespace-nowrap">
                <Logo size="sm" className="opacity-60 shrink-0" />
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="appearance-none bg-transparent pr-5 cursor-pointer focus:outline-none">
                  {EYANO_MODELS.filter((m) => m.available).map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#0D0F0E] text-[#F2FFF0]">{m.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-[#F2FFF0]/20 pointer-events-none" />
              </div>
            </div>

            {isStreaming ? (
              <button onClick={handleStop}
                className="shrink-0 p-2.5 rounded-full bg-red-500 text-white hover:bg-red-600 active:scale-90 transition-all duration-200 shadow-[0_0_15px_rgba(239,68,68,0.3)] mb-1 animate-pulse-subtle">
                <StopCircle className="h-4 w-4" />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={!canSend}
                className={cn('shrink-0 p-2.5 rounded-full transition-all duration-200 flex items-center justify-center mb-1',
                  'disabled:opacity-15 disabled:cursor-not-allowed',
                  canSend ? 'bg-[#39FF14] text-[#050505] hover:brightness-110 active:scale-90 shadow-[0_0_15px_rgba(57,255,20,0.25)]' : 'bg-[#F2FFF0]/[6%] text-[#F2FFF0]/20')}>
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {dropdownOpen && (
          <div className="absolute bottom-full left-3 mb-3 w-64 py-2 rounded-2xl bg-[#0D0F0E] border border-[#F2FFF0]/[8%] shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 overflow-hidden">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#F2FFF0]/20 border-b border-[#F2FFF0]/[4%] mb-1">Ajouter des medias</div>
            <button onClick={() => { imageInputRef.current?.click(); setDropdownOpen(false); }}
              className="group w-full flex items-center gap-4 px-4 py-3.5 text-[#F2FFF0]/70 hover:bg-[#39FF14]/[8%] hover:text-[#39FF14] active:bg-[#39FF14]/[15%] active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer">
              <div className="p-2.5 rounded-xl bg-[#39FF14]/[10%] border border-[#39FF14]/10 group-hover:bg-[#39FF14]/[20%] group-hover:border-[#39FF14]/20 group-active:scale-90 transition-all duration-200">
                <Image className="h-5 w-5 text-[#39FF14]" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold text-[#F2FFF0] group-hover:text-[#39FF14] transition-colors">Images</div>
                <div className="text-[11px] text-[#F2FFF0]/30 group-hover:text-[#39FF14]/60 transition-colors mt-0.5">PNG, JPG, GIF - Max 10 Mo</div>
              </div>
            </button>
            <button onClick={() => { fileInputRef.current?.click(); setDropdownOpen(false); }}
              className="group w-full flex items-center gap-4 px-4 py-3.5 mt-1 text-[#F2FFF0]/70 hover:bg-[#39FF14]/[8%] hover:text-[#39FF14] active:bg-[#39FF14]/[15%] active:scale-[0.98] transition-all duration-200 ease-out cursor-pointer">
              <div className="p-2.5 rounded-xl bg-[#39FF14]/[10%] border border-[#39FF14]/10 group-hover:bg-[#39FF14]/[20%] group-hover:border-[#39FF14]/20 group-active:scale-90 transition-all duration-200">
                <FileText className="h-5 w-5 text-[#39FF14]" />
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold text-[#F2FFF0] group-hover:text-[#39FF14] transition-colors">Documents</div>
                <div className="text-[11px] text-[#F2FFF0]/30 group-hover:text-[#39FF14]/60 transition-colors mt-0.5">PDF, TXT, DOC - Max 50 Mo</div>
              </div>
            </button>
          </div>
        )}
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && validateAndAddFiles(e.target.files)} />
      <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx" multiple className="hidden" onChange={(e) => e.target.files && validateAndAddFiles(e.target.files)} />

      <p className="text-center text-[10px] text-[#F2FFF0]/15 mt-3 select-none">
        Eyano — Propulse par l&apos;IA pour un avenir meilleur
      </p>
    </div>
  );
}
