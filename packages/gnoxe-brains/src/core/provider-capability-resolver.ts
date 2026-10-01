import { AIModel, EYANO_MODELS } from '@eyano/types';
import type { ProviderCapabilities } from '../providers/model-provider';

/**
 * CODES D'INCOMPATIBILITE modele <-> provider <-> capacite demandee.
 *
 * Tous deterministes : la meme donnee d'entree produit toujours le meme
 * code, dans le meme ordre, quel que soit le provider reel. Aucun code ne
 * depend d'un horloge, d'un identifiant de cle ou d'un nom de backend.
 */
export type ProviderCapabilityErrorCode =
  | 'PROVIDER_MODEL_UNKNOWN'
  | 'PROVIDER_MODEL_UNSUPPORTED'
  | 'PROVIDER_CAPABILITY_UNAVAILABLE';

/**
 * Refus explicite : le modele resolu ne peut pas etre execute par ce
 * provider avec les capacites demandees.
 *
 * Le message ne porte que des identifiants logiques et des noms de drapeaux
 * de capacite : jamais de nom de provider, jamais de nom de backend.
 */
export class ProviderCapabilityError extends Error {
  constructor(
    readonly code: ProviderCapabilityErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProviderCapabilityError';
  }
}

/**
 * Capacites explicitement exigees de l'appelant.
 *
 * Champs nommes exactement comme `ProviderCapabilities` : la demande se
 * lit comme un sous-ensemble des offres, il n'existe aucune traduction a
 * faire entre les deux contrats.
 */
export interface ProviderCapabilityRequirements {
  streaming?: boolean;
  structuredOutput?: boolean;
  images?: boolean;
}

export interface ProviderCapabilityRequest {
  /** Modele deja resolu par `ModelResolver`, tel quel. */
  model: string;
  /** Capacites exigees, si l'appelant en a besoin. */
  requires?: ProviderCapabilityRequirements;
}

/**
 * D'ordre fixe : la lecture d'une exigence multiple est donc stable.
 * Aucun drapeau n'est plus important qu'un autre, cette liste n'est qu'une
 * convention de lecture, jamais un classement.
 */
const CAPABILITY_FLAGS = ['streaming', 'structuredOutput', 'images'] as const;

/**
 * RESOLUTION DES CAPACITES PROVIDER - derniere porte avant l'execution.
 *
 * Repond a une seule question : "le modele resolu peut-il reellement etre
 * execute par CE provider avec les capacites demandees ?"
 *
 * Ce que cette couche fait :
 * - confronter le modele a `EYANO_MODELS` (existence) puis a
 *   `capabilities.models` (soutien du provider) ;
 * - exiger, un par un, les drapeaux de capacite explicitement demandes ;
 * - rejeter toute incompatibilite avant le moindre appel reseau.
 *
 * Ce qu'elle ne fait JAMAIS :
 * - proposer un autre modele quand une capacite manque (aucun substitut :
 *   un modele exigible non couvert est un refus, pas une degradation) ;
 * - comparer, classer ou scorer les providers (aucune priorite, aucun
 *   load balancing, aucun choix entre plusieurs providers) ;
 * - lire un tarif, une latence ou une metrique de qualite ;
 * - charger un catalogue : `EYANO_MODELS` est lu, jamais recopie ni etendu.
 *
 * Elle ne consomme que des informations de capacites DEJA EXISTANTES :
 * `ProviderCapabilities` (contrat `ModelProvider`) et `EYANO_MODELS`
 * (catalogue etape 19). Aucun nouveau type de capacite n'est invente.
 *
 * Ordre de decision, fixe et immutable :
 *   1. le modele existe-t-il au catalogue ? (`PROVIDER_MODEL_UNKNOWN`)
 *   2. ce provider le soutient-il ? (`PROVIDER_MODEL_UNSUPPORTED`)
 *   3. chaque capacite demandee est-elle offerte ? (`PROVIDER_CAPABILITY_UNAVAILABLE`)
 */
export class ProviderCapabilityResolver {
  resolve(capabilities: ProviderCapabilities, request: ProviderCapabilityRequest): AIModel {
    const entry = EYANO_MODELS.find((candidate) => candidate.id === request.model);

    if (!entry) {
      throw new ProviderCapabilityError(
        'PROVIDER_MODEL_UNKNOWN',
        `Modele inconnu au catalogue : "${request.model}". Modeles disponibles : ${EYANO_MODELS.map(
          (candidate) => candidate.id
        ).join(', ')}.`
      );
    }

    if (!capabilities.models.includes(entry.id)) {
      throw new ProviderCapabilityError(
        'PROVIDER_MODEL_UNSUPPORTED',
        `Modele "${entry.id}" non pris en charge par ce provider. Capacites declarees : ${
          capabilities.models.length > 0
            ? capabilities.models.join(', ')
            : 'aucun modele'
        }.`
      );
    }

    const requirements = request.requires ?? {};

    for (const flag of CAPABILITY_FLAGS) {
      if (requirements[flag] === true && capabilities[flag] !== true) {
        throw new ProviderCapabilityError(
          'PROVIDER_CAPABILITY_UNAVAILABLE',
          `Capacite "${flag}" demandee mais absente de ce provider.`
        );
      }
    }

    return entry.id;
  }
}

/** Instance unique de la couche : resolution sans memoire ni etat. */
export const providerCapabilityResolver = new ProviderCapabilityResolver();
