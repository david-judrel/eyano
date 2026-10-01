import { ModelProvider } from './model-provider';
import { providerRegistry } from './registry';
import { GeminiAdapter } from './gemini-adapter';

/**
 * Enregistrement par defaut des adapters.
 *
 * Aucune instruction conditionnelle n'est cachee ici : on ne bootstrap
 * que si le registry est vide, afin de ne jamais ecraser un provider
 * injecte par l'application (tests, futur backend open source, ...).
 */
export function ensureProvidersRegistered(): void {
  if (providerRegistry.list().length > 0) return;

  providerRegistry.register('gemini', new GeminiAdapter());
  providerRegistry.setActive('gemini');
}

/** Point d'entree recommande vers l'abstraction `ModelProvider`. */
export function getModelProvider(): ModelProvider {
  ensureProvidersRegistered();
  return providerRegistry.getActive();
}

/** Bascule de backend sans toucher aux agents ni a l'orchestrateur. */
export function setActiveModelProvider(id: string): void {
  ensureProvidersRegistered();
  providerRegistry.setActive(id);
}
