'use client';

import { Brain, Code, FileText, Lightbulb, ChevronRight, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Logo } from './ui/logo';

const suggestions = [
  { label: 'Explique-moi quelque chose', description: 'Comprends des concepts, idées ou sujets complexes', prompt: 'Explique-moi comment fonctionne le machine learning', icon: Brain },
  { label: 'Aide-moi à coder', description: 'Génère, corrige et améliore ton code', prompt: 'Aide-moi à créer une API REST avec Node.js', icon: Code },
  { label: 'Analyse un document', description: "Récupère l'essentiel et passe à l'action", prompt: 'Peux-tu analyser ce document pour moi ?', icon: FileText },
  { label: 'Donne-moi des idées', description: 'Stimule ta créativité et trouve de nouvelles pistes', prompt: 'Donne-moi des idées pour un projet innovant', icon: Lightbulb },
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
          <div className="mb-6 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[#39FF14]/[12%] bg-[#39FF14]/[8%] glow-brand">
            <Logo size="xl" />
          </div>
          
          <h1 className="text-4xl font-bold tracking-tight text-[#F2FFF0]">
            {firstName ? (
              <>Salut <span className="text-[#39FF14]">{firstName}</span></>
            ) : (
              'Eyano'
            )}
          </h1>
          
          <div className="mt-3 h-6 flex items-center justify-center">
            <p className="text-[16px] text-[#F2FFF0]/30 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#39FF14]/40 animate-pulse-subtle" />
              <span>{displayText}</span>
              <span className="inline-block w-[2px] h-4 bg-[#39FF14]/60 animate-pulse align-text-bottom" />
            </p>
          </div>
          
          <div className="mt-6 h-0.5 w-8 rounded-full bg-[#39FF14]/30 shadow-[0_0_10px_rgba(57,255,20,0.3)]" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {suggestions.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => setInput(s.prompt)}
                className={cn(
                  'group flex w-full items-start gap-4 rounded-2xl border border-[#F2FFF0]/[6%] bg-[#0D0F0E]/60 p-5 text-left backdrop-blur-md transition-all duration-200 hover:border-[#39FF14]/25 hover:bg-[#39FF14]/[4%]'
                )}
              >
                <div className="shrink-0 rounded-xl border border-[#39FF14]/10 bg-[#39FF14]/[8%] p-2.5 transition-colors group-hover:bg-[#39FF14]/[12%]">
                  <Icon className="h-5 w-5 text-[#39FF14]/70 group-hover:text-[#39FF14]" />
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[14px] font-semibold text-[#F2FFF0]/80 transition-colors group-hover:text-[#F2FFF0]">
                      {s.label}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#F2FFF0]/15 transition-colors group-hover:text-[#39FF14]/50" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-[#F2FFF0]/25 transition-colors group-hover:text-[#F2FFF0]/35">
                    {s.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
