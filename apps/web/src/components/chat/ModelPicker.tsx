'use client';

import { Check, ChevronDown } from 'lucide-react';
import { EYANO_MODELS } from '@eyano/types';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/overlay';

/**
 * Choix du modele, dans la barre d'outils du compositeur. Affiche
 * l'identifiant reel du modele (gnoxe-brains-1...), sa description dans le
 * menu ; les modeles pas encore disponibles sont visibles mais desactives.
 */
export function ModelPicker() {
  const { selectedModel, setSelectedModel } = useAppStore();
  const current = EYANO_MODELS.find((m) => m.id === selectedModel) ?? EYANO_MODELS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2 font-mono text-code" aria-label={`Modèle : ${current.id}`}>
          {current.id}
          <ChevronDown className="icon-xs text-foreground-muted" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-72">
        <DropdownMenuLabel>Modèle</DropdownMenuLabel>
        {EYANO_MODELS.map((model) => (
          <DropdownMenuItem
            key={model.id}
            disabled={!model.available}
            hint={model.available ? undefined : 'Bientôt'}
            onSelect={() => setSelectedModel(model.id)}
            className="h-auto py-2"
          >
            <span className="flex items-start gap-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-mono text-code">{model.id}</span>
                <span className="whitespace-normal text-caption text-foreground-muted">{model.description}</span>
              </span>
              {selectedModel === model.id && <Check className="icon-sm mt-0.5 text-brand-text" aria-label="Sélectionné" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
