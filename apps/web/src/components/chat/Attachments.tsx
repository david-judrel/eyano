'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, ImageOff, Maximize2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { MessageAttachment } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/feedback';
import { Button, IconButton } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/overlay';

/**
 * Telechargement d'une image deja chargee : l'URL blob est meme origine, le
 * navigateur gere la sauvegarde (nom de fichier conserve).
 */
function downloadImage(objectUrl: string, fileName: string) {
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName || 'image-kepler.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Image produite par Kepler : chargee avec le jeton (route protegee), puis
 * affichee en entier dans le fil.
 */
export function ImageResult({ id, fileName }: { id: string; fileName: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    api
      .getFileObjectUrl(id)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (src) {
    return (
      <>
        <figure className="group relative w-full max-w-md overflow-hidden rounded-lg border border-border-subtle">
          <button type="button" className="block w-full cursor-zoom-in" onClick={() => setOpen(true)} aria-label="Agrandir l'image">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL locale (blob) d'une image protegee */}
            <img src={src} alt="Image créée par Kepler" className="h-auto w-full" />
          </button>
          <figcaption className="sr-only">{fileName}</figcaption>
          <div className="absolute right-2 top-2 flex gap-1 lg:opacity-0 lg:focus-within:opacity-100 lg:group-hover:opacity-100">
            <IconButton label="Agrandir l'image" icon={Maximize2} size="sm" variant="secondary" onClick={() => setOpen(true)} />
            <IconButton
              label="Télécharger l'image"
              icon={Download}
              size="sm"
              variant="secondary"
              onClick={() => downloadImage(src, fileName)}
            />
          </div>
        </figure>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            title="Image créée par Kepler"
            description={fileName}
            size="lg"
            className="sm:max-w-4xl"
            footer={
              <Button variant="secondary" icon={Download} onClick={() => downloadImage(src, fileName)}>
                Télécharger
              </Button>
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- URL locale (blob) d'une image protegee */}
            <img src={src} alt="Image créée par Kepler" className="mx-auto h-auto w-full rounded-md border border-border-subtle" />
          </DialogContent>
        </Dialog>
      </>
    );
  }
  if (failed) {
    return (
      <div className="flex aspect-square w-full max-w-md flex-col items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface">
        <ImageOff className="icon-md text-foreground-muted" aria-hidden />
        <p className="text-body-sm text-foreground-muted">Image indisponible</p>
      </div>
    );
  }
  return <Skeleton className="aspect-square w-full max-w-md rounded-lg" aria-label="Chargement de l'image" />;
}

/** Pieces jointes d'un message : vignettes d'images, puis fichiers. */
export function Attachments({ attachments, align = 'start' }: { attachments: MessageAttachment[]; align?: 'start' | 'end' }) {
  const images = attachments.filter((a) => a.mimeType.startsWith('image/'));
  const files = attachments.filter((a) => !a.mimeType.startsWith('image/'));

  return (
    <div className={cn('flex flex-col gap-2', align === 'end' && 'items-end')}>
      {images.length > 0 && (
        <div className={cn('flex flex-wrap gap-2', align === 'end' && 'justify-end')}>
          {images.map((att, i) =>
            att.storageKey === 'db:kepler' && att.id ? (
              <ImageResult key={att.id} id={att.id} fileName={att.fileName} />
            ) : att.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- apercu local d'une image envoyee
              <img key={i} src={att.url} alt={att.fileName} className="h-32 w-auto max-w-60 rounded-lg border border-border-subtle object-cover" />
            ) : (
              <div key={i} className="flex h-32 w-32 items-center justify-center rounded-lg border border-border-subtle bg-surface p-2">
                <span className="truncate text-caption text-foreground-muted">{att.fileName}</span>
              </div>
            )
          )}
        </div>
      )}
      {files.length > 0 && (
        <ul className={cn('flex flex-wrap gap-2', align === 'end' && 'justify-end')}>
          {files.map((att, i) => (
            <li key={i} className="flex h-8 items-center gap-2 rounded-md border border-border-subtle bg-surface px-2">
              <FileText className="icon-xs text-foreground-muted" aria-hidden />
              <span className="max-w-40 truncate text-caption text-foreground-secondary">{att.fileName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
