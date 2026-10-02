'use client';

import { useEffect, useReducer, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, Download, RotateCcw, Loader2, Telescope, AlertCircle } from 'lucide-react';
import { api, KeplerRequestError } from '@/lib/api';
import {
  canSubmit,
  downloadFileName,
  imageDataUrl,
  initialKeplerState,
  keplerReducer,
  MAX_KEPLER_PROMPT_LENGTH,
} from '@/lib/kepler';
import { cn } from '@/lib/utils';

/**
 * Kepler Image (experimental) : prompt -> image.
 * Toute la logique d'etat vit dans `lib/kepler.ts` ; ce composant l'affiche.
 */
export function KeplerImage() {
  const router = useRouter();
  const [state, dispatch] = useReducer(keplerReducer, initialKeplerState);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!api.getToken()) router.push('/login');
  }, [router]);

  const loading = state.status === 'loading';
  const length = state.prompt.trim().length;

  const generate = async () => {
    if (!canSubmit(state)) return;
    dispatch({ type: 'submit' });
    try {
      const image = await api.generateImage(state.prompt.trim());
      dispatch({ type: 'success', image });
    } catch (error) {
      dispatch({ type: 'failure', code: error instanceof KeplerRequestError ? error.code : undefined });
    }
  };

  const newImage = () => {
    dispatch({ type: 'reset' });
    promptRef.current?.focus();
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        <button
          onClick={() => router.push('/')}
          className="mb-6 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-foreground/50 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </button>

        <header className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/[15%] bg-brand/[6%]">
            <Telescope className="h-5 w-5 text-brand" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">
            Kepler Image
            <span className="ml-2 align-middle rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-foreground/40">
              Expérimental
            </span>
          </h1>
          <p className="mt-1 text-[13px] text-foreground/40">Génération d&apos;images expérimentale</p>
        </header>

        {/* Zone de resultat : etat vide, generation, image ou erreur */}
        <section className="mb-5">
          {state.status === 'done' && state.image ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDataUrl(state.image)}
                alt={state.prompt.trim()}
                className="mx-auto block max-h-[70vh] w-full object-contain"
              />
              <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border p-3">
                <a
                  href={imageDataUrl(state.image)}
                  download={downloadFileName(state.image)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-medium text-brand-foreground transition-all hover:brightness-110"
                >
                  <Download className="h-4 w-4" /> Télécharger
                </a>
                <button
                  onClick={newImage}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-[13px] font-medium text-foreground/70 transition-colors hover:bg-foreground/[4%]"
                >
                  <RotateCcw className="h-4 w-4" /> Nouvelle image
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface animate-pulse">
              <Loader2 className="h-6 w-6 animate-spin text-brand" />
              <p className="text-[13px] text-foreground/50">Génération en cours…</p>
            </div>
          ) : state.status === 'error' ? (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[6%] p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-[13px] leading-relaxed text-red-300">{state.error}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
              <Sparkles className="h-5 w-5 text-foreground/25" />
              <p className="text-[13px] text-foreground/40">
                Décrivez l&apos;image que vous souhaitez créer, puis lancez la génération.
              </p>
            </div>
          )}
        </section>

        {/* Prompt : conserve pendant et apres la generation */}
        <div className="rounded-2xl border border-border bg-surface p-3 focus-within:border-brand/30">
          <label htmlFor="kepler-prompt" className="sr-only">
            Description de l&apos;image
          </label>
          <textarea
            id="kepler-prompt"
            ref={promptRef}
            value={state.prompt}
            onChange={(event) => dispatch({ type: 'prompt', value: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) generate();
            }}
            disabled={loading}
            rows={3}
            maxLength={MAX_KEPLER_PROMPT_LENGTH}
            placeholder="Un astronaute marchant sur Mars au coucher du soleil…"
            className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-foreground placeholder:text-foreground/25 focus:outline-none disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-[11px] text-foreground/30">
              {length}/{MAX_KEPLER_PROMPT_LENGTH}
            </span>
            <button
              onClick={generate}
              disabled={!canSubmit(state)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-all',
                'bg-brand text-brand-foreground hover:brightness-110 active:scale-[0.97]',
                'disabled:pointer-events-none disabled:opacity-40'
              )}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? 'Génération…' : state.status === 'error' ? 'Réessayer' : 'Générer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
