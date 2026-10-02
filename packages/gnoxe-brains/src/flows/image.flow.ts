import { getGnoxeBrains } from '../core/singleton';
import { GnoxeImageInput, GnoxeImageResult } from '../core/gnoxe-brains';

/**
 * Kepler Image : flow applicatif de generation d'image.
 *
 * Comme `chatFlow`, il passe par la facade GnoxeBrains (capacite,
 * validation, provider), jamais par un provider directement. Echecs :
 * `ImageGenerationError`, a code stable, que l'application traduit.
 */
export async function imageFlow(input: GnoxeImageInput): Promise<GnoxeImageResult> {
  return getGnoxeBrains().generateImage(input);
}
