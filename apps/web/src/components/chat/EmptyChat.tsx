'use client';

import { Brain, Code, FileText, Lightbulb } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Logo } from '@/components/ui/logo';

const suggestions = [
  { label: 'Explique-moi ça', prompt: 'Explique-moi ', icon: Brain },
  { label: 'Aide-moi à coder', prompt: 'Aide-moi à coder ', icon: Code },
  { label: 'Analyse un document', prompt: 'Analyse ce document pour moi : ', icon: FileText },
  { label: 'Donne-moi des idées', prompt: 'Donne-moi des idées pour ', icon: Lightbulb },
];

/** Accueil d'une conversation vide : un salut, quatre points de depart. */
export function EmptyChat() {
  const { setInput, user } = useAppStore();
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto flex w-full max-w-content flex-col items-center px-4 py-10 animate-fade-in sm:px-6 sm:py-24">
      <Logo size="xl" />
      <h1 className="mt-6 text-center text-heading-xl text-foreground">
        {firstName ? `Salut ${firstName}` : 'Eyano'}
      </h1>
      <p className="mt-2 text-center text-body-lg text-foreground-secondary">Comment puis-je vous aider aujourd&apos;hui ?</p>

      <div className="mt-8 grid w-full max-w-xl grid-cols-2 gap-2 sm:mt-10">
        {suggestions.map(({ label, prompt, icon: Icon }) => (
          <button
            key={label}
            type="button"
            onClick={() => setInput(prompt)}
            className="flex flex-col items-start gap-2 rounded-lg border border-border-subtle bg-surface-raised p-3 text-left transition-colors duration-fast hover:border-border-strong hover:bg-hover sm:flex-row sm:items-center sm:gap-3 sm:px-4"
          >
            <Icon className="icon-sm text-foreground-muted" aria-hidden />
            <span className="text-label text-foreground">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
