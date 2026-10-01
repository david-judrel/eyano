import { ChatMessage } from '@eyano/types';
import type { ModelUsage } from '../observability/usage';

/**
 * Contrat d'abstraction des modeles.
 *
 * Regle architecturale : seuls les adapters implementent cette interface.
 * L'Orchestrator, les Agents et les Flows ne dependent QUE de ce type.
 * Remplacer le backend revient a enregistrer un autre adapter.
 *
 * Aucun nom de fournisseur, aucun nom de modele reel : ce contrat est
 * strictement neutre.
 */
export interface ModelProvider {
  /** Identifiant technique du backend (nom de l'adaptateur, jamais un modele). */
  readonly name: string;

  generate(request: ModelRequest): Promise<ModelResponse>;

  stream(request: ModelRequest): AsyncIterable<ModelChunk>;

  /** Sortie structuree (JSON). L'adapter se charge de l'extraction. */
  structuredOutput(request: ModelRequest): Promise<unknown>;

  capabilities(): ProviderCapabilities;
}

export interface ModelRequest {
  /** Historique complet, system compris. Aucune couche superieure ne le reecrit. */
  messages: ChatMessage[];
  /** Identifiant logique `gnoxe-brains-*`. Jamais de nom de modele reel ici. */
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelResponse {
  content: string;
  /** Identifiant logique effectivement utilise (`gnoxe-brains-*`). */
  model: string;
  /** Nom du backend reellement utilise. */
  provider: string;
  /**
   * Usage de CET appel, si le backend le rapporte.
   *
   * POINT D EXTENSION MINIMAL de la telemetrie : le champ est optionnel et
   * n'est jamais renseigne par la couche d'abstraction. Un provider qui ne
   * connait aucun decompte laisse le champ absent ; aucun n'est invente ici
   * pour fabriquer des statistiques. Le tarif et le cout ne figurent jamais
   * sur ce contrat : ils appartiennent a une couche superieure.
   */
  usage?: ModelUsage;
}

export interface ModelChunk {
  /** `text` = fragment en cours ; `done` = texte final complet. */
  type: 'text' | 'done';
  content: string;
  /**
   * Identifiant logique reellement utilise, renseigne sur `done` quand le
   * provider connait la reponse. Permet a la facade applicative de tracer le
   * modele effectif plutot que celui demande.
   */
  model?: string;
  /**
   * Usage de l'appel en cours, renseigne sur `done` uniquement si le backend
   * le rapporte. Memes regles que `ModelResponse.usage` : optionnel, jamais
   * fabrique, jamais de tarif.
   */
  usage?: ModelUsage;
}

export interface ProviderCapabilities {
  streaming: boolean;
  structuredOutput: boolean;
  images: boolean;
  /** Identifiants logiques `gnoxe-brains-*` supportes par cet adapter. */
  models: string[];
}
