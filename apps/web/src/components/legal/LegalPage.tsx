import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { legal } from '@/lib/legal';
import { Logo } from '@/components/ui/logo';

const pages = [
  { href: '/conditions', label: "Conditions d'utilisation" },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/securite', label: 'Sécurité' },
];

/** Gabarit commun des pages legales : lecture longue, navigation entre elles. */
export function LegalPage({ title, current, children }: { title: string; current: string; children: ReactNode }) {
  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <header className="safe-top border-b border-border-subtle">
        <div className="mx-auto flex h-topbar max-w-content items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 rounded-md" aria-label="Retour à Eyano">
            <Logo size="md" />
            <span className="text-heading-sm text-foreground">Eyano</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 rounded-md text-label text-foreground-secondary hover:text-foreground touch:h-10">
            <ArrowLeft className="icon-sm" aria-hidden />
            Retour
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-content px-4 py-10 sm:px-6 sm:py-16">
        <nav aria-label="Informations légales" className="mb-8 flex flex-wrap gap-2">
          {pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              aria-current={page.href === current ? 'page' : undefined}
              className={
                page.href === current
                  ? 'rounded-md bg-selected px-3 py-1.5 text-label text-foreground'
                  : 'rounded-md px-3 py-1.5 text-label text-foreground-secondary hover:bg-hover hover:text-foreground'
              }
            >
              {page.label}
            </Link>
          ))}
        </nav>

        <h1 className="text-heading-xl text-foreground">{title}</h1>
        <p className="mt-2 text-body-sm text-foreground-muted">Dernière mise à jour : {legal.lastUpdated}</p>

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-border-subtle bg-surface-raised p-4">
          <FlaskConical className="icon-sm mt-0.5 text-brand-text" aria-hidden />
          <p className="text-body-sm text-foreground-secondary">
            {legal.product} est un <strong className="font-medium text-foreground">projet de recherche expérimental en intelligence artificielle</strong>,
            conçu par {legal.maker} pour {legal.organization} et mené par {legal.author}, {legal.authorRole}. Il est en cours de
            développement, présenté à des fins de démonstration et de recherche, et n&apos;a pas de vocation commerciale.
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-10">{children}</div>

        <footer className="mt-16 border-t border-border-subtle pt-6 text-body-sm text-foreground-muted">
          Une question ? Écrivez à{' '}
          <a href={`mailto:${legal.contactEmail}`} className="text-foreground underline underline-offset-4">
            {legal.contactEmail}
          </a>
          .
        </footer>
      </main>
    </div>
  );
}

/** Section numerotee d'une page legale. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-heading-md text-foreground">{title}</h2>
      <div className="flex flex-col gap-3 text-body-md text-foreground-secondary">{children}</div>
    </section>
  );
}

/** Liste a puces d'une page legale. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
