'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

import { ArrowUp, Camera, FileText, Image, Paperclip, Sparkles, Square, X } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast';
import { IconButton } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/overlay';

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
  /** « Créer une image » : proposé seulement si l'API l'annonce. */
  const [canCreateImages, setCanCreateImages] = useState(false);
  /** Mode image choisi : le message part à Kepler jusqu'à ce qu'on le retire. */
  const [imageMode, setImageMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getCapabilities()
      .then((capabilities) => {
        if (!cancelled) setCanCreateImages(Boolean(capabilities?.imageGeneration));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
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

    const pendingId = useAppStore.getState().streamingMessageId;
    if (pendingId) useAppStore.getState().updateMessage(pendingId, { imagePending: false });
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

            const pendingId = useAppStore.getState().streamingMessageId;
            if (pendingId) useAppStore.getState().updateMessage(pendingId, { imagePending: false });
            setIsStreaming(false);
            setStreamingContent('');
            setStreamingMessageId(null);
            abortRef.current = null;
          },

          onError: (error) => {
            const pendingId = useAppStore.getState().streamingMessageId;
            if (pendingId) useAppStore.getState().updateMessage(pendingId, { imagePending: false });
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
        },
        imageMode ? 'image' : undefined
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

      const pendingId = useAppStore.getState().streamingMessageId;
      if (pendingId) useAppStore.getState().updateMessage(pendingId, { imagePending: false });
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
    <div className="relative w-full min-w-0">
      {isDragging && (
        <div
          className="absolute inset-0 z-raised flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-focus bg-background animate-fade-in"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
        >
          <Paperclip className="icon-md text-foreground-muted" aria-hidden />
          <span className="text-label text-foreground">Déposez vos fichiers ici</span>
        </div>
      )}

      <div
        className={cn(
          'flex w-full min-w-0 flex-col rounded-xl border bg-surface-raised shadow-subtle transition-colors duration-fast',
          isDragging ? 'border-focus' : 'border-border hover:border-border-strong focus-within:border-focus'
        )}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
      >
        {attachedFiles.length > 0 && (
          <ul aria-label="Pièces jointes" className="flex flex-wrap gap-2 px-3 pt-3">
            {attachedFiles.map((af, i) => (
              <li key={`${af.file.name}-${i}`} className="relative shrink-0">
                {af.type === 'image' && af.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- apercu local (blob) avant envoi
                  <img src={af.preview} alt={af.file.name} className="h-16 w-16 rounded-md border border-border-subtle object-cover" />
                ) : (
                  <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-border-subtle bg-surface p-1">
                    <span className="text-caption font-medium text-foreground-secondary">{getFileIcon(af.file.name)}</span>
                    <span className="w-full truncate text-center text-caption text-foreground-muted">{af.file.name}</span>
                  </div>
                )}
                <button
                  type="button"
                  aria-label={`Retirer ${af.file.name}`}
                  onClick={() => removeFile(i)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-overlay text-foreground-secondary shadow-subtle transition-colors duration-fast hover:text-foreground"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {imageMode && (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setImageMode(false)}
              aria-label="Retirer le mode image"
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-brand-subtle px-3 text-label text-brand-text transition-colors duration-fast hover:bg-selected"
            >
              <Sparkles className="icon-xs" aria-hidden />
              Image
              <X className="icon-xs" aria-hidden />
            </button>
          </div>
        )}

        <div className="flex items-end gap-1 p-2">
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <IconButton label="Joindre un fichier ou créer une image" icon={Paperclip} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-60">
              {canCreateImages && (
                <DropdownMenuItem
                  icon={Sparkles}
                  hint="Kepler"
                  onSelect={() => {
                    setImageMode(true);
                    setTimeout(() => textareaRef.current?.focus(), 0);
                  }}
                >
                  Créer une image
                </DropdownMenuItem>
              )}
              <DropdownMenuItem icon={Image} hint="Galerie" onSelect={() => imageInputRef.current?.click()}>
                Image
              </DropdownMenuItem>
              <DropdownMenuItem icon={Camera} hint="Photo" onSelect={() => cameraInputRef.current?.click()}>
                Caméra
              </DropdownMenuItem>
              <DropdownMenuItem icon={FileText} hint="PDF, DOC" onSelect={() => fileInputRef.current?.click()}>
                Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="relative min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              aria-label="Message à Eyano"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                imageMode
                  ? "Décrivez l'image à créer…"
                  : attachedFiles.length > 0
                    ? 'Ajouter un message…'
                    : 'Posez votre question à Eyano…'
              }
              maxLength={MAX_CHARS}
              rows={1}
              className="scrollbar-hide block w-full min-w-0 resize-none overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words bg-transparent px-1 py-2 text-body-md text-foreground placeholder:text-foreground-muted focus-visible:outline-none"
              style={{ maxHeight: '200px' }}
            />
            {input.length > MAX_CHARS * 0.8 && (
              <div
                className={cn(
                  'absolute -bottom-1 right-0 text-caption tabular-nums',
                  input.length >= MAX_CHARS ? 'text-error' : 'text-foreground-muted'
                )}
              >
                {input.length}/{MAX_CHARS}
              </div>
            )}
          </div>

          {isStreaming ? (
            <IconButton label="Arrêter la génération" icon={Square} variant="secondary" onClick={handleStop} />
          ) : (
            <IconButton
              label="Envoyer"
              icon={ArrowUp}
              variant="primary"
              disabled={!canSend}
              loading={isSubmittingRef.current}
              onClick={handleSubmit}
            />
          )}
        </div>
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

      <p className="mt-2 select-none text-center text-caption text-foreground-muted">
        Eyano peut faire des erreurs. Vérifiez les informations importantes.
      </p>
    </div>
  );
}
