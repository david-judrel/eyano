import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--ey-background)',
        surface: {
          DEFAULT: 'var(--ey-surface)',
          2: 'var(--ey-surface-2)',
          3: 'var(--ey-surface-3)',
        },
        foreground: 'var(--ey-foreground)',
        muted: {
          DEFAULT: 'var(--ey-muted-foreground)',
          foreground: 'var(--ey-muted-foreground)',
        },
        border: {
          DEFAULT: 'var(--ey-border)',
          strong: 'var(--ey-border-strong)',
        },
        ring: 'var(--ey-ring)',
        brand: {
          DEFAULT: 'var(--ey-brand)',
          dim: 'var(--ey-brand-dim)',
          foreground: 'var(--ey-brand-foreground)',
        },
        primary: {
          DEFAULT: 'var(--ey-primary)',
          foreground: 'var(--ey-primary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--ey-destructive)',
          foreground: 'var(--ey-destructive-foreground)',
        },
        overlay: 'var(--ey-overlay)',
        glass: 'var(--ey-glass)',
      },
      borderRadius: {
        'ey-sm': 'calc(var(--ey-radius) * 0.5)',
        'ey-md': 'var(--ey-radius)',
        'ey-lg': 'var(--ey-radius-lg)',
        'ey-xl': 'calc(var(--ey-radius) * 1.5)',
        'ey-2xl': 'calc(var(--ey-radius) * 2)',
        'ey-full': '9999px',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-right': {
          from: { opacity: '1', transform: 'translateX(0)' },
          to: { opacity: '0', transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 0.2s ease-out',
        'pulse-subtle': 'pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        bounce: 'bounce 1s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-out-right': 'slide-out-right 0.2s ease-in forwards',
      },
    },
  },
  plugins: [],
};

export default config;
