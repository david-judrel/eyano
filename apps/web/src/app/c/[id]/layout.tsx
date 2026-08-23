import type { Metadata } from 'next';
import { siteConfig } from '@/lib/metadata';

type Props = {
  params: { id: string };
};

export function generateMetadata({ params }: Props): Metadata {
  const conversationUrl = `${siteConfig.url}/c/${params.id}`;

  return {
    title: 'Conversation',
    description: `Consultez cette conversation sur ${siteConfig.name}. Assistant intelligent propulse par Gnoxe AI.`,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: `Conversation | ${siteConfig.name}`,
      description: `Consultez cette conversation sur ${siteConfig.name}. Assistant intelligent propulse par Gnoxe AI.`,
      url: conversationUrl,
      siteName: siteConfig.name,
      type: 'article',
      locale: 'fr_FR',
      images: [
        {
          url: siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: `${siteConfig.name} — Conversation`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Conversation | ${siteConfig.name}`,
      description: `Consultez cette conversation sur ${siteConfig.name}.`,
      images: [siteConfig.ogImage],
    },
    other: {
      'og:see-also': conversationUrl,
    },
  };
}

export default function ConversationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
