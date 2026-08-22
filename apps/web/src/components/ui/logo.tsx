'use client';

import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-10 w-10',
};

export function Logo({ size = 'md', className }: LogoProps) {
  return (
    <img
      src="/icon.png"
      alt="Eyano"
      className={cn(sizeClasses[size], 'object-contain', className)}
    />
  );
}
