/**
 * Drapeaux de fonctionnalite du web, figes au build (`NEXT_PUBLIC_*`).
 *
 * Kepler Image (experimental) : coupe par defaut, seule la valeur exacte
 * `true` l'active. Coupe : aucune entree dans la Sidebar, `/kepler` en 404.
 */
export const KEPLER_IMAGE_ENABLED = process.env.NEXT_PUBLIC_KEPLER_IMAGE === 'true';
