export { AIProvider, GenerateOptions } from './ai-provider';
export { GnoxeBrainsProvider } from './gnoxe-brains.provider';

export {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelChunk,
  ProviderCapabilities,
  ImageRequest,
  ImageResponse,
  ImageGenerationError,
  ImageGenerationErrorCode,
} from './model-provider';
// Kepler Image : identifiants LOGIQUES seulement ; le modele reel reste
// interne a l'adapter (aucun resolveur backend exporte).
export {
  DEFAULT_IMAGE_MODEL_ID,
  listRegisteredImageModels,
  isRegisteredImageModel,
} from './model-registry';
export { ProviderRegistry, providerRegistry } from './registry';
export {
  ensureProvidersRegistered,
  getModelProvider,
  setActiveModelProvider,
} from './bootstrap';
// Surface publique : aucun symbole nommant un fournisseur concret.
// L'adapter est enregistre en interne par `ensureProvidersRegistered()`.
export type { ProviderKeyMetrics, ProviderKeyStatus } from './health';
export { getProviderKeyMetrics, resetProviderKeys } from './health';
export {
  DEFAULT_MODEL_ID,
  isRegisteredModel,
  resolveBackendModel,
  resolveLogicalModel,
  listRegisteredModels,
} from './model-registry';

import { AIProvider } from './ai-provider';
import { GnoxeBrainsProvider } from './gnoxe-brains.provider';

let defaultProvider: AIProvider | null = null;

/**
 * @deprecated Point d'entree ancien style, conserve pour les flows existants.
 * Utiliser `getModelProvider()`.
 */
export function getAIProvider(): AIProvider {
  if (!defaultProvider) {
    defaultProvider = new GnoxeBrainsProvider();
  }
  return defaultProvider;
}

export function setAIProvider(provider: AIProvider): void {
  defaultProvider = provider;
}

/**
 * Nom du provider reellement actif, a enregistrer en telemetrie.
 * Aucun littoral `'gemini'` en dur dans les consommateurs.
 */
export function getActiveProviderName(): string {
  return getAIProvider().name;
}
