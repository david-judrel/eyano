import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * EYANO — Tailwind n'expose que les jetons semantiques du Design System
 * (src/styles/tokens.css). Voir DESIGN-SYSTEM.md.
 */

/** Jeton opaque : accepte les modificateurs d'opacite de Tailwind. */
const token = (name: string) => `rgb(var(--ey-${name}) / <alpha-value>)`;
/** Jeton deja translucide : utilise tel quel. */
const translucent = (name: string) => `rgb(var(--ey-${name}))`;

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
        background: { DEFAULT: token('background'), subtle: token('background-subtle') },
        surface: {
          DEFAULT: token('surface'),
          raised: token('surface-raised'),
          overlay: token('surface-overlay'),
          inverse: token('surface-inverse'),
          // Alias de migration (a supprimer en fin de migration).
          2: token('surface-raised'),
          3: token('surface-overlay'),
        },
        foreground: {
          DEFAULT: token('foreground'),
          secondary: token('foreground-secondary'),
          muted: token('foreground-muted'),
          disabled: token('foreground-disabled'),
          inverse: token('foreground-inverse'),
        },
        border: {
          DEFAULT: translucent('border'),
          subtle: translucent('border-subtle'),
          strong: translucent('border-strong'),
        },
        brand: {
          DEFAULT: token('brand'),
          hover: token('brand-hover'),
          active: token('brand-active'),
          foreground: token('brand-foreground'),
          text: token('brand-text'),
          subtle: translucent('brand-subtle'),
          // Alias de migration.
          dim: translucent('brand-subtle'),
        },
        success: { DEFAULT: token('success'), subtle: translucent('success-subtle') },
        warning: { DEFAULT: token('warning'), subtle: translucent('warning-subtle') },
        error: { DEFAULT: token('error'), subtle: translucent('error-subtle') },
        info: { DEFAULT: token('info'), subtle: translucent('info-subtle') },
        hover: translucent('hover'),
        pressed: translucent('pressed'),
        selected: translucent('selected'),
        focus: token('focus'),
        scrim: translucent('scrim'),
        // Alias de migration.
        muted: { DEFAULT: token('foreground-muted'), foreground: token('foreground-muted') },
        primary: { DEFAULT: token('brand'), foreground: token('brand-foreground') },
        destructive: { DEFAULT: token('error'), foreground: token('foreground-inverse') },
        ring: token('focus'),
        overlay: translucent('scrim'),
        glass: token('surface-overlay'),
      },

      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      /* Echelle typographique fermee : taille / interligne / graisse / approche. */
      fontSize: {
        display: ['2.25rem', { lineHeight: '2.75rem', fontWeight: '600', letterSpacing: '-0.025em' }],
        'heading-xl': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '600', letterSpacing: '-0.02em' }],
        'heading-lg': ['1.375rem', { lineHeight: '1.875rem', fontWeight: '600', letterSpacing: '-0.015em' }],
        'heading-md': ['1.125rem', { lineHeight: '1.625rem', fontWeight: '600', letterSpacing: '-0.01em' }],
        'heading-sm': ['0.9375rem', { lineHeight: '1.375rem', fontWeight: '600', letterSpacing: '-0.005em' }],
        'body-lg': ['1rem', { lineHeight: '1.625rem', fontWeight: '400' }],
        'body-md': ['0.9375rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        label: ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '500' }],
        caption: ['0.75rem', { lineHeight: '1rem', fontWeight: '400', letterSpacing: '0.005em' }],
        code: ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '400' }],
      },

      /* Arrondis : 4 niveaux + plein. Voir DESIGN-SYSTEM.md pour leurs roles. */
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        // Alias de migration.
        '2xl': '20px',
        '3xl': '20px',
      },

      boxShadow: {
        subtle: 'var(--ey-shadow-subtle)',
        raised: 'var(--ey-shadow-raised)',
        overlay: 'var(--ey-shadow-overlay)',
      },

      zIndex: {
        raised: '10',
        sticky: '20',
        overlay: '40',
        dropdown: '50',
        modal: '60',
        toast: '70',
        tooltip: '80',
      },

      width: { sidebar: 'var(--ey-sidebar-width)' },
      height: { topbar: 'var(--ey-topbar-height)' },
      maxWidth: { content: 'var(--ey-content-width)' },

      transitionDuration: {
        fast: 'var(--ey-duration-fast)',
        normal: 'var(--ey-duration-normal)',
        slow: 'var(--ey-duration-slow)',
      },
      transitionTimingFunction: {
        standard: 'var(--ey-ease-standard)',
        emphasized: 'var(--ey-ease-emphasized)',
      },

      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'pulse-subtle': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        // Alias de migration (anciennes animations encore referencees).
        'slide-down': { from: { opacity: '0', transform: 'translateY(-6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        bounce: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
        'slide-out-right': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in var(--ey-duration-normal) var(--ey-ease-standard)',
        'fade-out': 'fade-out var(--ey-duration-fast) var(--ey-ease-standard)',
        'scale-in': 'scale-in var(--ey-duration-normal) var(--ey-ease-emphasized)',
        'slide-up': 'slide-up var(--ey-duration-slow) var(--ey-ease-emphasized)',
        'slide-in-left': 'slide-in-left var(--ey-duration-slow) var(--ey-ease-emphasized)',
        'slide-in-right': 'slide-in-right var(--ey-duration-slow) var(--ey-ease-emphasized)',
        'pulse-subtle': 'pulse-subtle 1.6s var(--ey-ease-standard) infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'slide-down': 'slide-down var(--ey-duration-normal) var(--ey-ease-standard)',
        bounce: 'bounce 1s ease-in-out infinite',
        'slide-out-right': 'slide-out-right var(--ey-duration-fast) var(--ey-ease-standard) forwards',
      },
    },
  },
  plugins: [
    plugin(({ addComponents }) => {
      /* Tailles d'icone : 4 niveaux. */
      addComponents({
        '.icon-xs': { width: '14px', height: '14px', flexShrink: '0' },
        '.icon-sm': { width: '16px', height: '16px', flexShrink: '0' },
        '.icon-md': { width: '20px', height: '20px', flexShrink: '0' },
        '.icon-lg': { width: '24px', height: '24px', flexShrink: '0' },
      });
    }),
  ],
};

export default config;
