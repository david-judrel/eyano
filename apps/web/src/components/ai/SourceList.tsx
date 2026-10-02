import { ExternalLink } from 'lucide-react';

export interface Source {
  title: string;
  url: string;
  /** Domaine ou media affiche (rfi.fr, Wikipedia...). */
  site?: string;
  /** Date de publication, deja formatee. */
  date?: string;
}

/**
 * Sources d'une reponse (recherche, outils). Sous la reponse, en caption :
 * informatives, jamais concurrentes du texte.
 */
export function SourceList({ sources, label = 'Sources' }: { sources: Source[]; label?: string }) {
  if (sources.length === 0) return null;
  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <h4 className="text-caption text-foreground-muted">{label}</h4>
      <ol className="flex flex-wrap gap-1.5">
        {sources.map((source, index) => (
          <li key={source.url}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 max-w-64 items-center gap-1.5 rounded-sm border border-border-subtle bg-surface px-2 text-caption text-foreground-secondary transition-colors duration-fast hover:border-border-strong hover:text-foreground"
            >
              <span className="tabular-nums text-foreground-muted">{index + 1}</span>
              <span className="truncate">{source.site ?? source.title}</span>
              {source.date && <span className="text-foreground-muted">{source.date}</span>}
              <ExternalLink className="h-3 w-3 shrink-0 text-foreground-muted" aria-hidden />
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
