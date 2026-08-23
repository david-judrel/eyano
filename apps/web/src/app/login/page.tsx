import type { Metadata } from 'next';
import { LoginContent } from '@/components/LoginContent';
import { siteConfig } from '@/lib/metadata';

export const metadata: Metadata = {
  title: 'Connexion',
  description: `Connectez-vous a votre espace ${siteConfig.name}. Acces securise par email ou Google.`,
  openGraph: {
    title: `Connexion | ${siteConfig.name}`,
    description: `Connectez-vous a votre espace ${siteConfig.name}. Acces securise par email ou Google.`,
    url: `${siteConfig.url}/login`,
    siteName: siteConfig.name,
    type: 'website',
    locale: 'fr_FR',
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — Connexion`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `Connexion | ${siteConfig.name}`,
    description: `Connectez-vous a votre espace ${siteConfig.name}. Acces securise par email ou Google.`,
    images: [siteConfig.ogImage],
  },
};

export default function LoginPage() {
  return <LoginContent />;
}
