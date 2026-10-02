import { getDefaultModel } from '../models';

/**
 * Configuration propre a GnoxeBrains.
 *
 * Ne contient AUCUN detail de provider : les identifiants de modeles reels
 * restent la responsabilite unique de `providers/model-registry.ts`.
 *
 * Ne contient AUCUN parametre d'execution non plus : il n'y a ni temperature
 * ni budget de tokens par defaut. Un parametre non fourni reste absent
 * (cf. `core/execution-policy.ts`, `core/defaults.ts`).
 */
export interface GnoxeBrainsConfig {
  /** Identifiant logique du modele utilise par defaut (`gnoxe-brains-*`). */
  defaultModel: string;
  /** Nombre maximum de messages conserves dans le contexte de conversation. */
  maxContextMessages: number;
  /**
   * Duree maximale d'une mission en ms (`0` = illimite).
   *
   * STATUT A CE STAGE : DECLARATIVE, JAMAIS APPLIQUEE.
   * La valeur est lue nulle part : il n'existe aucune minuterie d'execution,
   * aucun comparateur de duree et aucun abort lie au delai. `0` (valeur par
   * defaut) documente l'absence de limite plutot qu'un illimite volontaire.
   *
   * Point d'insertion minimal le jour ou la mecanique sera implementee :
   * `GnoxeBrains.run()`, autour de l'appel a `MissionExecutor.execute()`,
   * avec cloture `FAILED` de la meme maniere qu'une exception traversee.
   * Aucune valeur n'est arbitrairement fixee ici (cf. etape 16).
   */
  missionTimeoutMs: number;
}

export const DEFAULT_GNOXE_BRAINS_CONFIG: Readonly<GnoxeBrainsConfig> = Object.freeze({
  defaultModel: getDefaultModel(),
  maxContextMessages: 20,
  missionTimeoutMs: 0,
});

let currentConfig: GnoxeBrainsConfig = { ...DEFAULT_GNOXE_BRAINS_CONFIG };

export function getGnoxeBrainsConfig(): Readonly<GnoxeBrainsConfig> {
  return currentConfig;
}

/** Ajuste la configuration globale. Les valeurs non fournies sont conservees. */
export function configureGnoxeBrains(
  patch: Partial<GnoxeBrainsConfig>
): Readonly<GnoxeBrainsConfig> {
  currentConfig = { ...currentConfig, ...patch };
  return currentConfig;
}

export function resetGnoxeBrainsConfig(): Readonly<GnoxeBrainsConfig> {
  currentConfig = { ...DEFAULT_GNOXE_BRAINS_CONFIG };
  return currentConfig;
}
