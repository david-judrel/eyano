'use client';

import { cn } from '@/lib/utils';

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
};

export function Avatar({ src, alt, fallback, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt || ''}
        className={cn('rounded-xl object-cover', sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl bg-white/[6%] flex items-center justify-center font-medium text-white/40',
        sizeClasses[size],
        className,
      )}
    >
      {fallback || '?'}
    </div>
  );
}
