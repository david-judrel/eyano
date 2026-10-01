import { AIModel, AIModelInfo, EYANO_MODELS } from '@eyano/types';
import { DEFAULT_MODEL_ID } from './providers/model-registry';

/**
 * Aucune donnee de catalogue n'est redifiee ici : le paquet reexporte la
 * table unique de `@eyano/types` et n'ajoute que les interrogations locales.
 * C'est ce qui a supprime le doublon autrefois maintenu cote interface.
 */
export { EYANO_MODELS };

export function getModelInfo(modelId: AIModel): AIModelInfo | undefined {
  return EYANO_MODELS.find((m) => m.id === modelId);
}

export function getAvailableModels(): AIModelInfo[] {
  return EYANO_MODELS.filter((m) => m.available);
}

export function getDefaultModel(): AIModel {
  return DEFAULT_MODEL_ID;
}
