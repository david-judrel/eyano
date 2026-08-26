import type { Metadata } from 'next';

const PRODUCTION_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://eyano.site';

export const siteConfig = {
  name: 'Eyano',
  title: 'Eyano — Assistant IA Intelligent',
  description:
    "Connectez-vous, partagez et decouvrez sur Eyano. Assistant intelligent propulse par Gnoxe AI.",
  url: PRODUCTION_URL,
  ogImage: `${PRODUCTION_URL}/icon-512.png`,
  creator: 'Gnoxe Technology',
  keywords: [
    'assistant IA',
    'intelligence artificielle',
    'Eyano',
    'Gnoxe AI',
    'chat IA',
    'productivite',
  ],
};

export function getDefaultMetadata(overrides?: Partial<Metadata>): Metadata {
  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: siteConfig.title,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    keywords: siteConfig.keywords,
    authors: [{ name: siteConfig.creator }],
    creator: siteConfig.creator,
    publisher: siteConfig.creator,
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      url: siteConfig.url,
      siteName: siteConfig.name,
      title: siteConfig.title,
      description: siteConfig.description,
      images: [
        {
          url: siteConfig.ogImage,
          width: 512,
          height: 512,
          alt: `${siteConfig.name} — Assistant IA Intelligent`,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: siteConfig.title,
      description: siteConfig.description,
      images: [siteConfig.ogImage],
      creator: '@eyano',
    },
    other: {
      'og:image:secure_url': siteConfig.ogImage,
      'og:image:width': '512',
      'og:image:height': '512',
      'theme-color': '#050505',
      'msapplication-TileColor': '#050505',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    icons: {
      icon: '/icon-192.png',
      apple: '/icon-512.png',
    },
    manifest: '/manifest.json',
    ...overrides,
  };
}
