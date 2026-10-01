import { getKeyManager } from './gemini-adapter';
import type { Metrics, KeyStatus } from './gemini-key-manager';

/**
 * Facade neutre sur l'etat interne du transport de modele (rotation de cles).
 *
 * `apps/` consomme uniquement ces symboles : aucun nom de fournisseur
 * n'apparait dans les importateurs applicatifs ni dans les libelles d'audit.
 * Seul le dossier `providers/` sait a qui ces cles appartiennent.
 */
export type ProviderKeyStatus = KeyStatus;
export type ProviderKeyMetrics = Metrics;

/** Metriques de rotation des cles (jamais les cles elles-memes). */
export function getProviderKeyMetrics(): ProviderKeyMetrics {
  return getKeyManager().getMetrics();
}

/** Remet toutes les cles en etat disponible. */
export function resetProviderKeys(): void {
  getKeyManager().resetAllKeys();
}
