import { AIModel, EYANO_MODELS } from '@eyano/types';

/**
 * CODES D'INCOMPATIBILITE entre une demande et le catalogue.
 *
 * Une seule famille de codes, tous deterministes : la meme demande produit
 * toujours le meme code, dans la meme situation. Aucun code ne depend du
 * fournisseur, du contexte ou de l'horloge.
 */
export type ModelResolutionErrorCode =
  | 'MODEL_UNKNOWN'
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_INSUFFICIENT_CAPACITY'
  | 'NO_MODEL_MEETS_REQUIREMENT'
  | 'MODEL_INVALID_REQUIREMENT';

/**
 * Refus explicite d'une resolution de modele.
 *
 * Le message porte uniquement des identifiants logiques : jamais un nom de
 * backend, conformement a la regle d'identite Eyano. L'erreur est rejetee
 * AVANT tout appel modele, donc aucun appel n'est consomme sur un refus.
 */
export class ModelResolutionError extends Error {
  constructor(
    readonly code: ModelResolutionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ModelResolutionError';
  }
}

/**
 * Capacites explicitement demandees a la resolution.
 *
 * Seules les capacites DEJA presentes dans le catalogue sont exigibles :
 * `minMaxTokens` confronte l'entree `maxTokens` du catalogue. Aucune
 * capacite n'est inventee, aucun attribut n'est ajoute au catalogue pour
 * les besoins de cette couche.
 */
export interface ModelResolutionRequest {
  /** Identifiant logique demande, si l'appelant en choisit un. */
  model?: string;
  /** Capacite minimale, en jetons, explicitement exigee. */
  minMaxTokens?: number;
}

function availableEntries() {
  return EYANO_MODELS.filter((entry) => entry.available);
}

function availableSummary(): string {
  return availableEntries()
    .map((entry) => `${entry.id} (${entry.maxTokens})`)
    .join(', ');
}

function normalizeMinTokens(minMaxTokens?: number): number | undefined {
  if (minMaxTokens === undefined) return undefined;

  if (
    typeof minMaxTokens !== 'number' ||
    !Number.isFinite(minMaxTokens) ||
    !Number.isInteger(minMaxTokens) ||
    minMaxTokens <= 0
  ) {
    throw new ModelResolutionError(
      'MODEL_INVALID_REQUIREMENT',
      `Capacite invalide : ${String(minMaxTokens)}. Attendu un entier strictement positif.`
    );
  }

  return minMaxTokens;
}

/**
 * RESOLVER DE MODELE - selection deterministe a partir du catalogue.
 *
 * Ce que cette couche fait :
 * - lire `EYANO_MODELS` (la source de verite de l'etape 19) et rien d'autre ;
 * - repondre a la question : quel modele logique satisfait cette demande ? ;
 * - refuser toute incompatibilite par une erreur explicite et deterministe.
 *
 * Ce qu'elle ne fait JAMAIS :
 * - choisir en fonction du cout, de la latence, de la qualite ou de la
 *   charge (aucun score, aucun classement, aucun load balancing) ;
 * - substituer silencieusement un modele a un autre (aucun repli : un
 *   modele demande mais incompatible est un refus, jamais une degradation) ;
 * - ouvrir un acces a un fournisseur, ajouter un modele ou creer un
 *   catalogue de parallel.
 *
 * Ordre de decision, fixe et immutable :
 *   1. exigence de capacite validee ;
 *   2. si un modele est demande : presence au catalogue, puis
 *      disponibilite, puis capacite : dans cet ordre ;
 *   3. sinon : filtre sur les modeles disponibles satisfaisant l'exigence,
 *      puis preference pour l'entree `default` si elle est eligible, sinon
 *      la premiere entree selon l'ordre du catalogue.
 *
 * L'etape 3 n'est pas un classement : `default` est unique (verrouille en
 * etape 19) et l'ordre du catalogue est stable.
 */
export class ModelResolver {
  resolve(request: ModelResolutionRequest = {}): AIModel {
    const minMaxTokens = normalizeMinTokens(request.minMaxTokens);
    const requested = request.model?.trim();

    if (requested) {
      const entry = EYANO_MODELS.find((candidate) => candidate.id === requested);

      if (!entry) {
        throw new ModelResolutionError(
          'MODEL_UNKNOWN',
          `Modele inconnu : "${requested}". Modeles disponibles : ${availableEntries()
            .map((candidate) => candidate.id)
            .join(', ')}.`
        );
      }

      if (!entry.available) {
        throw new ModelResolutionError(
          'MODEL_UNAVAILABLE',
          `Modele non disponible : "${requested}". Modeles disponibles : ${availableEntries()
            .map((candidate) => candidate.id)
            .join(', ')}.`
        );
      }

      if (minMaxTokens !== undefined && entry.maxTokens < minMaxTokens) {
        throw new ModelResolutionError(
          'MODEL_INSUFFICIENT_CAPACITY',
          `Modele "${requested}" : capacite ${entry.maxTokens} < ${minMaxTokens} demandes. Offre : ${availableSummary()}.`
        );
      }

      return entry.id;
    }

    const eligible = availableEntries().filter(
      (entry) => minMaxTokens === undefined || entry.maxTokens >= minMaxTokens
    );

    if (eligible.length === 0) {
      throw new ModelResolutionError(
        'NO_MODEL_MEETS_REQUIREMENT',
        minMaxTokens === undefined
          ? 'Aucun modele disponible dans le catalogue.'
          : `Aucun modele disponible ne couvre ${minMaxTokens} tokens. Offre : ${availableSummary()}.`
      );
    }

    const selected = eligible.find((entry) => entry.default) ?? eligible[0];
    return selected.id;
  }
}

/** Instance unique de la couche : resolution sans memoire ni etat. */
export const modelResolver = new ModelResolver();
