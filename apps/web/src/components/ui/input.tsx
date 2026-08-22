'use client';

import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'h-11 w-full rounded-xl border border-white/[8%] bg-white/[4%] px-4 text-[14px] text-white placeholder:text-white/25',
          'transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/20 focus-visible:border-brand/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
