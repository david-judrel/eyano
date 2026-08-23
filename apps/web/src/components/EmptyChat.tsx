'use client';

import { Brain, Code, FileText, Lightbulb, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Logo } from './ui/logo';

const suggestions = [
  { label: 'Explique-moi ça', prompt: 'Explique-moi ', icon: Brain },
  { label: 'Aide-moi à coder', prompt: 'Aide-moi à coder ', icon: Code },
  { label: 'Analyse un document', prompt: 'Analyse ce document pour moi : ', icon: FileText },
  { label: 'Donne-moi des idées', prompt: 'Donne-moi des idées pour ', icon: Lightbulb },
];

const greetings = [
  'Comment puis-je vous aider aujourd\'hui ?',
  'Que puis-je faire pour vous ?',
  'Sur quoi puis-je vous assister ?',
  'Je suis à votre écoute.',
  'Posez-moi une question !',
  'Comment puis-je vous être utile ?',
];

function getFirstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  return parts[0];
}

export function EmptyChat() {
  const { setInput, user } = useAppStore();
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const firstName = getFirstName(user?.name);

  useEffect(() => {
    const currentGreeting = greetings[greetingIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && displayText === currentGreeting) {
      timeout = setTimeout(() => setIsDeleting(true), 3000);
    } else if (isDeleting && displayText === '') {
      setIsDeleting(false);
      setGreetingIndex((prev) => (prev + 1) % greetings.length);
    } else if (isDeleting) {
      timeout = setTimeout(() => {
        setDisplayText(currentGreeting.substring(0, displayText.length - 1));
      }, 30);
    } else {
      timeout = setTimeout(() => {
        setDisplayText(currentGreeting.substring(0, displayText.length + 1));
      }, 50);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, greetingIndex]);

  return (
    <div className="w-full px-4 py-10 animate-fade-in">
      <div className="mx-auto max-w-2xl text-center space-y-10">
        
        <div className="flex flex-col items-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-brand/[12%] bg-brand/[8%] glow-brand">
            <Logo size="xl" />
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {firstName ? (
              <>Salut <span className="text-brand">{firstName}</span></>
            ) : (
              'Eyano'
            )}
          </h1>
          
          <div className="mt-3 h-6 flex items-center justify-center">
            <p className="text-[16px] text-foreground/30 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand/40 animate-pulse-subtle" />
              <span>{displayText}</span>
              <span className="inline-block w-[2px] h-4 bg-brand/60 animate-pulse align-text-bottom" />
            </p>
          </div>
          
          <div className="mt-6 h-0.5 w-8 rounded-full bg-brand/30 shadow-[0_0_10px_rgba(57,255,20,0.3)]" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {suggestions.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => setInput(s.prompt)}
                className={cn(
                  'group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface/60 p-6 text-center backdrop-blur-md transition-all duration-200 hover:border-brand/25 hover:bg-brand/[4%] min-h-[140px]'
                )}
              >
                <div className="shrink-0 rounded-xl border border-brand/10 bg-brand/[8%] p-2.5 transition-colors group-hover:bg-brand/[12%]">
                  <Icon className="h-5 w-5 text-brand/70 group-hover:text-brand" />
                </div>
                <span className="text-[13px] font-semibold text-foreground/80 transition-colors group-hover:text-foreground leading-snug">
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
