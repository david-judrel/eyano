import Link from 'next/link';
import { cn } from '@/lib/utils';

const linkClass =
  'whitespace-nowrap text-foreground-secondary underline decoration-border-strong underline-offset-2 transition-colors duration-fast hover:text-foreground hover:decoration-foreground';

/**
 * Mention d'acceptation des conditions, a l'inscription. Les liens s'ouvrent
 * dans un nouvel onglet : le formulaire en cours n'est pas perdu.
 */
export function LegalConsent({ action, className }: { action: 'create' | 'continue'; className?: string }) {
  return (
    <p className={cn('text-balance text-center text-body-sm text-foreground-muted', className)}>
      {action === 'create' ? 'En créant un compte' : 'En continuant'}, vous acceptez les{' '}
      <Link href="/conditions" target="_blank" rel="noopener noreferrer" className={linkClass}>
        Conditions d&apos;utilisation
      </Link>{' '}
      et la{' '}
      <Link href="/confidentialite" target="_blank" rel="noopener noreferrer" className={linkClass}>
        Politique de confidentialité
      </Link>
      .
    </p>
  );
}
