/**
 * Kepler Image (experimental) : drapeau de fonctionnalite, COUPE par defaut.
 *
 * Seule la valeur exacte `true` l'active. Coupe, le module n'est pas
 * importe : `/api/image/generate` n'existe pas (404 de Nest).
 */
export function isKeplerImageEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.KEPLER_IMAGE_ENABLED === 'true';
}

/**
 * Retouche d'images (image precedente ou photo envoyee) : COUPEE par defaut,
 * trop couteuse pour cette version. Coupee, une demande de retouche recoit
 * une reponse d'Eyano qui l'explique, sans aucune generation.
 */
export function isKeplerImageEditEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isKeplerImageEnabled(env) && env.KEPLER_IMAGE_EDIT_ENABLED === 'true';
}
