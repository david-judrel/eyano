'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

import {
  Send,
  X,
  Image,
  FileText,
  Paperclip,
  StopCircle,
  Loader2,
  Camera,
} from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast';

interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'file';
}

const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_IMAGES = 4;
const MAX_FILES = 5;
const MAX_CHARS = 10000;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} Ko`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(name: string): string {
  const lowerName = name.toLowerCase();

  if (lowerName.endsWith('.pdf')) return 'PDF';
  if (/\.(txt|md)$/.test(lowerName)) return 'TXT';
  if (lowerName.endsWith('.csv')) return 'CSV';
  if (lowerName.endsWith('.json')) return 'JSON';
  if (/\.xlsx?$/.test(lowerName)) return 'XLS';
  if (/\.docx?$/.test(lowerName)) return 'DOC';
  if (/\.pptx?$/.test(lowerName)) return 'PPT';

  return 'FILE';
}

function fileToBase64(
  file: File
): Promise<{ mimeType: string; data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const result = reader.result as string;
        const base64 = result.split(',')[1];

        if (!base64) {
          reject(new Error('Impossible de lire le fichier'));
          return;
        }

        resolve({
          mimeType: file.type,
          data: base64,
        });
      } catch (error) {
        reject(error);
      }
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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Verrou anti-double-soumission
  const isSubmittingRef = useRef(false);
  const lastSubmitTime = useRef(0);

  const router = useRouter();

  const {
    input,
    setInput,
    activeConversationId,
    setActiveConversationId,
    addMessage,
    updateMessage,
    isStreaming,
    setIsStreaming,
    streamingMessageId,
    setStreamingMessageId,
    streamingContent,
    setStreamingContent,
    appendStreamingContent,
    selectedModel,
    user,
    addConversation,
    updateConversation,
    pendingGuestMessage,
    setPendingGuestMessage,
  } = useAppStore();

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { addToast } = useToast();

  /**
   * Message invité en attente après connexion
   */
  useEffect(() => {
    if (pendingGuestMessage && user && !isStreaming) {
      setInput(pendingGuestMessage);
      setPendingGuestMessage(null);

      setTimeout(() => {
        handleSubmit();
      }, 100);
    }
  }, [
    pendingGuestMessage,
    user,
    isStreaming,
    setInput,
    setPendingGuestMessage,
  ]);

  /**
   * Auto-resize du textarea
   */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';

      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [input]);

  /**
   * Fermer le dropdown lorsqu'on clique ailleurs
   */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /**
   * Nettoyage des previews lorsque le composant est démonté
   */
  useEffect(() => {
    return () => {
      attachedFiles.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [attachedFiles]);

  /**
   * Ajouter des fichiers
   */
  const validateAndAddFiles = useCallback(
    (fileList: FileList | File[]) => {
      const current = attachedFiles;
      const newFiles: AttachedFile[] = [];

      let imageCount = current.filter(
        (f) => f.type === 'image'
      ).length;

      let fileCount = current.length;

      for (const f of Array.from(fileList)) {
        if (fileCount >= MAX_FILES) {
          addToast(
            `Maximum ${MAX_FILES} fichiers par message`,
            'warning'
          );
          break;
        }

        const isImage = IMAGE_TYPES.includes(f.type);

        if (isImage) {
          if (imageCount >= MAX_IMAGES) {
            addToast(
              `Maximum ${MAX_IMAGES} images par message`,
              'warning'
            );
            continue;
          }

          if (f.size > MAX_IMAGE_SIZE) {
            addToast(
              `${f.name} dépasse ${formatSize(MAX_IMAGE_SIZE)}`,
              'error'
            );
            continue;
          }

          imageCount++;
        } else {
          if (f.size > MAX_FILE_SIZE) {
            addToast(
              `${f.name} dépasse ${formatSize(MAX_FILE_SIZE)}`,
              'error'
            );
            continue;
          }
        }

        newFiles.push({
          file: f,
          type: isImage ? 'image' : 'file',
          preview: isImage
            ? URL.createObjectURL(f)
            : undefined,
        });

        fileCount++;
      }

      if (newFiles.length > 0) {
        setAttachedFiles((prev) => [...prev, ...newFiles]);
      }
    },
    [attachedFiles, addToast]
  );

  /**
   * Coller une image / un fichier
   */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;

      if (!items) return;

      const files: File[] = [];

      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();

          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        validateAndAddFiles(files);
      }
    },
    [validateAndAddFiles]
  );

  /**
   * Drag & Drop
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        validateAndAddFiles(e.dataTransfer.files);
      }
    },
    [validateAndAddFiles]
  );

  /**
   * Supprimer une pièce jointe
   */
  const removeFile = (index: number) => {
    setAttachedFiles((prev) => {
      const removed = prev[index];

      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }

      return prev.filter((_, i) => i !== index);
    });
  };

  /**
   * Arrêter le streaming
   */
  const handleStop = () => {
    abortRef.current?.abort();

    setIsStreaming(false);
    setStreamingContent('');
    setStreamingMessageId(null);
  };

  /**
   * Envoi du message
   */
  const handleSubmit = async () => {
    // Couche 1 : protection immediata
    const now = Date.now();
    if (isSubmittingRef.current || isStreaming || now - lastSubmitTime.current < 1500) {
      return;
    }

    if (!input.trim() && attachedFiles.length === 0) {
      return;
    }

    // Verrouillage immediat
    isSubmittingRef.current = true;
    lastSubmitTime.current = now;

    try {
      /**
       * Utilisateur non connecté
       */
      if (!user) {
        onRequireLogin?.(input.trim());
        return;
      }

      let message = input.trim();

      /**
       * Message automatique si uniquement des fichiers
       */
      if (!message && attachedFiles.length > 0) {
        const names = attachedFiles
          .map((f) => f.file.name)
          .join(', ');

        message =
          attachedFiles.length === 1
            ? `Pièce jointe : ${names}`
            : `${attachedFiles.length} pièces jointes : ${names}`;
      }

      /**
       * Vider immédiatement l'input
       */
      setInput('');
      setDropdownOpen(false);

      /**
       * Créer une conversation si nécessaire
       */
      let convId = activeConversationId;

      if (!convId) {
        const conv = await api.createConversation();

        convId = conv.id;

        setActiveConversationId(conv.id);
        addConversation(conv);

        router.push(`/c/${conv.id}`);
      }

      /**
       * IMPORTANT :
       * Garantit que convId est bien un string
       * avant de l'utiliser dans chatStream.
       */
      if (!convId) {
        throw new Error(
          'Impossible de déterminer l’identifiant de la conversation'
        );
      }

      const finalConvId = convId;

      /**
       * ID temporaire unique pour le message utilisateur
       */
      const tempUserMsgId = `user-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 11)}`;

      /**
       * Ajouter immédiatement le message utilisateur
       */
      addMessage({
        id: tempUserMsgId,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
        attachments: attachedFiles.map((af) => ({
          fileName: af.file.name,
          mimeType: af.file.type,
          size: af.file.size,
          url: af.preview,
        })),
      });

      /**
       * Convertir les images en Base64
       */
      const images: {
        mimeType: string;
        data: string;
      }[] = [];

      for (const af of attachedFiles) {
        if (af.type === 'image' && af.file) {
          const img = await fileToBase64(af.file);
          images.push(img);
        }
      }

      /**
       * Préparer les fichiers avant de vider le state
       */
      const filesToSend = [...attachedFiles];

      setAttachedFiles([]);

      /**
       * Activer le streaming
       */
      setIsStreaming(true);
      setStreamingContent('');

      const abortController = new AbortController();
      abortRef.current = abortController;

      let currentMessageId = '';

      /**
       * Appel API streaming
       */
      await api.chatStream(
        finalConvId,
        message,
        selectedModel,
        images.length > 0 ? images : undefined,
        {
          onStart: () => {
            // Rien à faire pour le moment
          },

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
              const currentMessage =
                useAppStore
                  .getState()
                  .messages.find(
                    (m) => m.id === currentMessageId
                  );

              updateMessage(currentMessageId, {
                content:
                  (currentMessage?.content || '') +
                  chunk.content,
              });
            }
          },

          onDone: (data) => {
            if (currentMessageId) {
              const currentMessage =
                useAppStore
                  .getState()
                  .messages.find(
                    (m) => m.id === currentMessageId
                  );

              updateMessage(currentMessageId, {
                content: currentMessage?.content || '',
                status: 'COMPLETED',
                inputTokens: data.inputTokens,
                outputTokens: data.outputTokens,
              });
            }

            if (data.title) {
              updateConversation(finalConvId, {
                title: data.title,
              });
            }

            setIsStreaming(false);
            setStreamingContent('');
            setStreamingMessageId(null);
            abortRef.current = null;
          },

          onError: (error) => {
            setIsStreaming(false);
            setStreamingContent('');
            setStreamingMessageId(null);
            abortRef.current = null;

            addMessage({
              id: `error-${Date.now()}`,
              role: 'assistant',
              content: error.message,
              status: 'FAILED',
              createdAt: new Date().toISOString(),
            });
          },
        }
      );

      /**
       * Libérer les previews
       */
      filesToSend.forEach((f) => {
        if (f.preview) {
          URL.revokeObjectURL(f.preview);
        }
      });
    } catch (err) {
      console.error('Submit error:', err);

      setIsStreaming(false);
      setStreamingContent('');
      setStreamingMessageId(null);
      abortRef.current = null;
    } finally {
      // Deverrouillage avec delai de securite
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 500);
    }
  };

  /**
   * Gestion de la touche Enter
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();

        handleSubmit();
      }
    },
    [handleSubmit]
  );

  /**
   * État du bouton envoyer
   */
  const canSend =
    (input.trim() || attachedFiles.length > 0) &&
    !isStreaming &&
    !isSubmittingRef.current;

  return (
    <div className="w-full min-w-0 pb-2 pt-1 relative">
      {isDragging && (
        <div
          className="absolute inset-x-0 bottom-0 top-[-100px] z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-md rounded-3xl border-2 border-dashed border-brand/50 animate-in fade-in"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
        >
          <div className="p-4 rounded-full bg-brand/10 mb-3">
            <Paperclip className="h-8 w-8 text-brand" />
          </div>

          <span className="text-lg font-semibold text-foreground">
            Déposez vos fichiers ici
          </span>
        </div>
      )}

      <div
        ref={dropdownRef}
        className="relative w-full"
      >
        <div
          className={cn(
            'relative flex flex-col rounded-[2rem] transition-all duration-300 w-full min-w-0 overflow-hidden',
            'border backdrop-blur-xl',

            attachedFiles.length > 0
              ? 'bg-surface/95 border-brand/30 shadow-[0_0_25px_rgba(57,255,20,0.08)]'
              : isDragging
                ? 'border-brand/40 bg-surface/90 shadow-[0_0_30px_rgba(57,255,20,0.1)]'
                : canSend
                  ? 'border-brand/20 bg-surface/80 shadow-[0_0_15px_rgba(57,255,20,0.05)]'
                  : 'border-border bg-surface/60 hover:border-border-strong'
          )}

          onDrop={handleDrop}

          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}

          onDragLeave={() => setIsDragging(false)}
        >
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-4 pb-2 animate-in slide-in-from-top-2 duration-300">
              {attachedFiles.map((af, i) => (
                <div
                  key={`${af.file.name}-${i}`}
                  className="relative group/file shrink-0"
                >
                  {af.type === 'image' && af.preview ? (
                    <div className="w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] rounded-xl overflow-hidden border border-border bg-background">
                      <img
                        src={af.preview}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-[80px] h-[80px] sm:w-[100px] sm:h-[100px] rounded-xl border border-border bg-background flex flex-col items-center justify-center gap-1.5 p-2">
                      <div className="w-8 h-8 rounded-lg bg-brand/[10%] border border-brand/20 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-brand">
                          {getFileIcon(af.file.name)}
                        </span>
                      </div>

                      <span className="text-[9px] text-foreground/50 font-medium truncate w-full text-center px-1">
                        {af.file.name}
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-surface-3 border border-border flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-all hover:bg-red-500/20 hover:border-red-500/40 z-10"
                  >
                    <X className="h-3 w-3 text-foreground/60" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 px-3 py-3">
            <div className="shrink-0 mb-1">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={cn(
                  'p-2.5 rounded-xl transition-all duration-200 border',

                  dropdownOpen
                    ? 'text-brand bg-brand/[8%] border-brand/20 rotate-45'
                    : 'text-foreground/25 hover:text-foreground/60 hover:bg-surface-2 border-transparent hover:border-border'
                )}
              >
                <Paperclip className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 min-w-0 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={
                  attachedFiles.length > 0
                    ? 'Ajouter un message...'
                    : 'Posez votre question à Eyano...'
                }
                maxLength={MAX_CHARS}
                rows={1}
                className="w-full min-w-0 bg-transparent resize-none text-[15px] leading-relaxed py-2.5 pr-2 text-foreground/90 placeholder:text-foreground/25 focus:outline-none focus:ring-0 overflow-y-auto overflow-x-hidden break-words whitespace-pre-wrap scrollbar-hide"
                style={{ maxHeight: '200px' }}
              />
              {input.length > MAX_CHARS * 0.8 && (
                <div className={cn(
                  "absolute -bottom-1 right-0 text-[10px] font-medium tabular-nums",
                  input.length >= MAX_CHARS ? "text-red-400" : "text-muted"
                )}>
                  {input.length}/{MAX_CHARS}
                </div>
              )}
            </div>

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="shrink-0 p-2.5 rounded-full bg-red-500 text-white hover:bg-red-600 active:scale-90 transition-all duration-200 shadow-[0_0_15px_rgba(239,68,68,0.3)] mb-1 animate-pulse-subtle"
              >
                <StopCircle className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend}
                className={cn(
                  'shrink-0 p-2.5 rounded-full transition-all duration-200 flex items-center justify-center mb-1',
                  'disabled:opacity-15 disabled:cursor-not-allowed',

                  canSend
                    ? 'bg-brand text-brand-foreground hover:brightness-110 active:scale-90 shadow-[0_0_15px_rgba(57,255,20,0.25)]'
                    : 'bg-border text-foreground/20'
                )}
              >
                {isSubmittingRef.current ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>

        {dropdownOpen && (
          <div className="absolute bottom-full left-0 mb-3 w-56 rounded-2xl bg-surface/95 backdrop-blur-xl border border-border shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 overflow-hidden p-1.5">
            <button
              type="button"
              onClick={() => {
                imageInputRef.current?.click();
                setDropdownOpen(false);
              }}
              className="group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-foreground/60 hover:bg-brand/[8%] hover:text-foreground active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              <Image className="h-4 w-4 text-foreground/30 group-hover:text-brand transition-colors" />

              <span className="text-[13px] font-medium">
                Image
              </span>

              <span className="ml-auto text-[11px] text-foreground/15 group-hover:text-foreground/25 transition-colors">
                Galerie
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                cameraInputRef.current?.click();
                setDropdownOpen(false);
              }}
              className="group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-foreground/60 hover:bg-brand/[8%] hover:text-foreground active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              <Camera className="h-4 w-4 text-foreground/30 group-hover:text-brand transition-colors" />

              <span className="text-[13px] font-medium">
                Caméra
              </span>

              <span className="ml-auto text-[11px] text-foreground/15 group-hover:text-foreground/25 transition-colors">
                Photo
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                fileInputRef.current?.click();
                setDropdownOpen(false);
              }}
              className="group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-foreground/60 hover:bg-brand/[8%] hover:text-foreground active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              <FileText className="h-4 w-4 text-foreground/30 group-hover:text-brand transition-colors" />

              <span className="text-[13px] font-medium">
                Document
              </span>

              <span className="ml-auto text-[11px] text-foreground/15 group-hover:text-foreground/25 transition-colors">
                PDF, DOC
              </span>
            </button>
          </div>
        )}
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            validateAndAddFiles(e.target.files);
          }

          e.target.value = '';
        }}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            validateAndAddFiles(e.target.files);
          }

          e.target.value = '';
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            validateAndAddFiles(e.target.files);
          }

          e.target.value = '';
        }}
      />

      <p className="text-center text-[10px] text-foreground/15 mt-3 select-none px-4">
        Eyano peut faire des erreurs. Verifiez les informations importantes.
      </p>
    </div>
  );
}