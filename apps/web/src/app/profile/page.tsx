import type { Metadata } from 'next';
import { ProfileContent } from '@/components/ProfileContent';
import { siteConfig } from '@/lib/metadata';

export const metadata: Metadata = {
  title: 'Mon Profil',
  description: `Gerez votre profil, preferences et parametres de securite sur ${siteConfig.name}.`,
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: `Mon Profil | ${siteConfig.name}`,
    description: `Gerez votre profil, preferences et parametres de securite sur ${siteConfig.name}.`,
    url: `${siteConfig.url}/profile`,
    siteName: siteConfig.name,
    type: 'profile',
    locale: 'fr_FR',
  },
};

export default function ProfilePage() {
  return <ProfileContent />;
}
