import { AIModel, EYANO_MODELS } from '@eyano/types';

/**
 * Source de verite unique du mapping `gnoxe-brains-*` -> modele reel du backend.
 *
 * Regle : il ne doit exister qu'UN SEUL endroit de traduction des modeles.
 * Toute couche superieure manipule les identifiants `gnoxe-brains-*`,
 * seul l'adapter appelant `resolveBackendModel()` connait le modele reel.
 *
 * Ce fichier est la VUE D'EXECUTION du catalogue. La table des modeles
 * (nom, capacite, disponibilite, defaut) vit dans `@eyano/types` afin
 * d'etre partagee avec l'interface sans jamais emmener un nom de backend
 * dans le navigateur. Les cles du registre sont derivees des seules
 * entrees `available` : un modele disponible sans backend leve une erreur
 * au chargement plutot que de partir en echec silencieux au moment de
 * l'appel.
 *
 * Regle 2 : un identifiant inconnu est REFUSE. Il n'existe aucun repli
 * silencieux : servir un modele different de celui demande corromprait la
 * telemetrie et la facturation.
 */
const MODEL_BACKEND: Partial<Record<AIModel, string>> = {
  'gnoxe-brains-1': 'gemini-3.5-flash-lite',
  'gnoxe-brains-1.5': 'gemini-3.6-flash',
};

function buildRegistry(): Record<string, string> {
  const registry: Record<string, string> = {};

  for (const entry of EYANO_MODELS) {
    if (!entry.available) continue;
    const backend = MODEL_BACKEND[entry.id];
    if (!backend) {
      throw new Error(
        `Modele disponible sans backend : "${entry.id}". Ajoutez une entree a MODEL_BACKEND.`
      );
    }
    registry[entry.id] = backend;
  }

  return registry;
}

const MODEL_REGISTRY = buildRegistry();

const DEFAULT_ENTRY = EYANO_MODELS.find((entry) => entry.default) ?? EYANO_MODELS[0];

/** Identifiant logique utilise quand l'appelant n'en choisit pas. */
export const DEFAULT_MODEL_ID: AIModel = DEFAULT_ENTRY.id;

function isRegistered(model?: string): model is string {
  return Boolean(model && Object.prototype.hasOwnProperty.call(MODEL_REGISTRY, model));
}

/** Vrai si l'identifiant logique existe dans le registre. */
export function isRegisteredModel(model?: string): boolean {
  return isRegistered(model);
}

/** Identifiants logiques effectivement disponibles. */
export function listRegisteredModels(): string[] {
  return Object.keys(MODEL_REGISTRY);
}

function assertKnown(model?: string): void {
  if (model && !isRegistered(model)) {
    throw new Error(
      `Modele inconnu : "${model}". Modeles disponibles : ${listRegisteredModels().join(', ')}.`
    );
  }
}

export function resolveBackendModel(model?: string): string {
  assertKnown(model);
  return isRegistered(model) ? MODEL_REGISTRY[model] : MODEL_REGISTRY[DEFAULT_MODEL_ID];
}

export function resolveLogicalModel(model?: string): string {
  assertKnown(model);
  return isRegistered(model) ? model : DEFAULT_MODEL_ID;
}

// ------------------------------------------------ Kepler Image (images)

/**
 * Registre des modeles de GENERATION D'IMAGES, meme regle que le chat : le
 * seul endroit qui traduit un identifiant logique `kepler-image-*` en
 * modele reel. Separe d'`EYANO_MODELS` : un modele image n'est pas un
 * modele de conversation et ne doit pas apparaitre dans le selecteur.
 * Changer de variante = changer cette table, rien d'autre.
 */
const IMAGE_MODEL_BACKEND: Readonly<Record<string, string>> = Object.freeze({
  'kepler-image-1': 'gemini-2.5-flash-image',
});

/** Identifiant logique utilise quand l'appelant n'en choisit pas. */
export const DEFAULT_IMAGE_MODEL_ID = 'kepler-image-1';

/** Identifiants logiques d'images disponibles. */
export function listRegisteredImageModels(): string[] {
  return Object.keys(IMAGE_MODEL_BACKEND);
}

/** Vrai si l'identifiant logique d'image existe (absent = defaut). */
export function isRegisteredImageModel(model?: string): boolean {
  return !model || Object.prototype.hasOwnProperty.call(IMAGE_MODEL_BACKEND, model);
}

/** Identifiant logique effectif (defaut si absent). Inconnu : `null`. */
export function resolveLogicalImageModel(model?: string): string | null {
  if (!model) return DEFAULT_IMAGE_MODEL_ID;
  return isRegisteredImageModel(model) ? model : null;
}

/** Modele reel du backend (adapter UNIQUEMENT). Inconnu : `null`. */
export function resolveBackendImageModel(model?: string): string | null {
  const logical = resolveLogicalImageModel(model);
  return logical ? IMAGE_MODEL_BACKEND[logical] : null;
}
