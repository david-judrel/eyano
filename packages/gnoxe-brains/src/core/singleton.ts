import { GnoxeBrains } from './gnoxe-brains';

let singleton: GnoxeBrains | null = null;

/**
 * Instance GnoxeBrains partagee par les flows applicatifs.
 *
 * Les flows (`chatFlow`, `chatFlowSync`, `titleFlow`) sont des facades de
 * compatibilite : ils traduisent leurs contrats historiques vers cette
 * instance plutot que d'appeler directement un provider.
 */
export function getGnoxeBrains(): GnoxeBrains {
  if (!singleton) {
    singleton = new GnoxeBrains();
  }
  return singleton;
}

/**
 * Injecte l'instance a utiliser.
 * Sert aux tests (provider factice) et a une application qui veut partager
 * une instance configuree. `null` provoque une re-creation paresseuse.
 */
export function setGnoxeBrains(brains: GnoxeBrains | null): void {
  singleton = brains;
}
