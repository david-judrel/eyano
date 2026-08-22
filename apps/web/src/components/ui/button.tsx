'use client';

import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium',
    'transition-all duration-150 active:scale-[0.97]',
    'disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090a]',
  ],
  {
    variants: {
      variant: {
        brand: 'bg-brand text-black hover:brightness-110',
        primary: 'bg-white/[8%] text-white hover:bg-white/[12%]',
        secondary: 'bg-white/[4%] text-white/60 hover:bg-white/[8%]',
        outline: 'border border-white/[8%] bg-transparent text-white/60 hover:bg-white/[4%]',
        ghost: 'bg-transparent text-white/60 hover:bg-white/[6%]',
        destructive: 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-10 px-4 text-[13px]',
        lg: 'h-12 px-6 text-[14px]',
        icon: 'h-10 w-10 shrink-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
