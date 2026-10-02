/**
 * Kepler Image (experimental) : drapeau de fonctionnalite, COUPE par defaut.
 *
 * Seule la valeur exacte `true` l'active. Coupe, le module n'est pas
 * importe : `/api/image/generate` n'existe pas (404 de Nest).
 */
export function isKeplerImageEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.KEPLER_IMAGE_ENABLED === 'true';
}
