'use client';

import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  /** Initiales affichees sans image. */
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-7 w-7 text-caption',
  md: 'h-8 w-8 text-label',
  lg: 'h-12 w-12 text-heading-sm',
};

export function Avatar({ src, alt, fallback, size = 'md', className }: AvatarProps) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- image distante (fournisseur d'identite), taille fixe
    return <img src={src} alt={alt || ''} className={cn('shrink-0 rounded-full object-cover', sizeClasses[size], className)} />;
  }
  return (
    <div
      role="img"
      aria-label={alt || fallback || 'Avatar'}
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-selected font-medium text-foreground-secondary', sizeClasses[size], className)}
    >
      {fallback || '?'}
    </div>
  );
}
