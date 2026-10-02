'use client';

import { useEffect, useState } from 'react';
import { FileText, ImageOff } from 'lucide-react';
import { api } from '@/lib/api';
import type { MessageAttachment } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/feedback';

/**
 * Image produite par Kepler : chargee avec le jeton (route protegee), puis
 * affichee en entier dans le fil.
 */
export function ImageResult({ id, fileName }: { id: string; fileName: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

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
      <figure className="w-full max-w-md overflow-hidden rounded-lg border border-border-subtle">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL locale (blob) d'une image protegee */}
        <img src={src} alt="Image créée par Kepler" className="h-auto w-full" />
        <figcaption className="sr-only">{fileName}</figcaption>
      </figure>
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
