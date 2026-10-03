import Link from 'next/link';
import { cn } from '@/lib/utils';

const linkClass = 'text-foreground-secondary underline underline-offset-4 hover:text-foreground';

/**
 * Mention d'acceptation des conditions, a l'inscription. Les liens s'ouvrent
 * dans un nouvel onglet : le formulaire en cours n'est pas perdu.
 */
export function LegalConsent({ action, className }: { action: 'create' | 'continue'; className?: string }) {
  return (
    <p className={cn('text-center text-caption text-foreground-muted', className)}>
      {action === 'create' ? 'En créant un compte' : 'En continuant'}, vous acceptez les{' '}
      <Link href="/conditions" target="_blank" rel="noopener noreferrer" className={linkClass}>
        Conditions d&apos;utilisation
      </Link>{' '}
      et la{' '}
      <Link href="/confidentialite" target="_blank" rel="noopener noreferrer" className={linkClass}>
        Politique de confidentialité
      </Link>{' '}
      d&apos;Eyano, projet de recherche expérimental.
    </p>
  );
}
