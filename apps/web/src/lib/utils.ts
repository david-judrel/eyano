import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge doit connaitre l'echelle du Design System : sinon il prend
 * `text-label` pour une couleur et le supprime face a `text-foreground`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'heading-xl', 'heading-lg', 'heading-md', 'heading-sm', 'body-lg', 'body-md', 'body-sm', 'label', 'caption', 'code'] },
      ],
      shadow: [{ shadow: ['subtle', 'raised', 'overlay'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;

  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function groupByDate(items: { createdAt: string }[]): Record<string, typeof items> {
  const groups: Record<string, typeof items> = {};

  for (const item of items) {
    const label = formatDate(item.createdAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }

  return groups;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}
