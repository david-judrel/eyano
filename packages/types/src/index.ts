export interface ImageAttachment {
  mimeType: string;
  data: string; // base64 encoded
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: ImageAttachment[];
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  model?: string;
  attachments?: FileAttachment[];
}

export interface FileAttachment {
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  model: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  lastMessage?: string;
}

/**
 * CATALOGUE PUBLIC DES MODELES - source de verite unique de l'offre visible.
 *
 * Une seule table decrit les modeles : identifiant, libelle, capacite,
 * disponibilite et modele par defaut. Ce catalogue est consomme par le paquet
 * d'intelligence ET par l'interface, qui jusque la en maintenaient chacun
 * une copie deja divergente.
 *
 * Regle d'identite : AUCUN nom de fournisseur ni nom de backend ici. Ce
 * fichier entre dans le bundle navigateur. Le mapping d'execution
 * (`gnoxe-brains-*` -> modele reel) vit dans
 * `@eyano/gnoxe-brains/providers/model-registry.ts`, qui derive ses cles des
 * seules entrees `available` de cette table. Un test verrouille l'egalite des
 * deux vues : un modele disponible sans backend, ou l'inverse, casse la
 * construction plutot que de produire un echec silencieux.
 */
export const EYANO_MODELS = [
  {
    id: 'gnoxe-brains-1',
    name: 'Gnoxe Brains 1',
    description: 'Modèle généraliste, rapide et efficace',
    maxTokens: 8192,
    available: true,
    default: true,
  },
  {
    id: 'gnoxe-brains-1.5',
    name: 'Gnoxe Brains 1.5',
    description: 'Modèle avancé, plus de raisonnement',
    maxTokens: 16384,
    available: true,
    default: false,
  },
  {
    id: 'gnoxe-brains-2',
    name: 'Gnoxe Brains 2',
    description: 'Prochainement disponible',
    maxTokens: 32768,
    available: false,
    default: false,
  },
  {
    id: 'gnoxe-brains-code',
    name: 'Gnoxe Brains Code',
    description: 'Optimisé pour le code',
    maxTokens: 16384,
    available: false,
    default: false,
  },
  {
    id: 'gnoxe-brains-vision',
    name: 'Gnoxe Brains Vision',
    description: 'Multimodal, analyse d\'images',
    maxTokens: 8192,
    available: false,
    default: false,
  },
] as const;

/**
 * Identifiants connus. Derives du catalogue : ajouter ou retirer un modele
 * se fait dans `EYANO_MODELS` et nulle part ailleurs.
 */
export type AIModel = (typeof EYANO_MODELS)[number]['id'];

export interface AIModelInfo {
  id: AIModel;
  name: string;
  description: string;
  maxTokens: number;
  /**
   * Expose dans le selecteur. Une entree `available: false` reste au
   * catalogue (nom, capacite, futur tarif) mais n'est JAMAIS executable :
   * `isRegisteredModel()` la refuse et aucun appel ne peut la resoudre.
   */
  available: boolean;
  /**
   * Exactement une entree du catalogue porte `true`. C'est le modele utilise
   * quand l'appelant n'en choisit pas, sur toutes les couches.
   */
  default: boolean;
}

export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: Record<string, { inputTokens: number; outputTokens: number }>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: unknown;
}
