import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KeplerImage } from '@/components/KeplerImage';
import { KEPLER_IMAGE_ENABLED } from '@/lib/features';
import { siteConfig } from '@/lib/metadata';

export const metadata: Metadata = {
  title: 'Kepler Image',
  description: `Génération d'images expérimentale sur ${siteConfig.name}.`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function KeplerPage() {
  // Experimental : sans le drapeau, la page n'existe pas.
  if (!KEPLER_IMAGE_ENABLED) notFound();
  return <KeplerImage />;
}
