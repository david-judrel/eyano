import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { imageFlow, ImageGenerationError, ImageGenerationErrorCode } from '@eyano/gnoxe-brains';

/** Reponse de Kepler Image : image en base64, type MIME, modele logique. */
export interface KeplerImageResult {
  data: string;
  mimeType: string;
  model: string;
}

/**
 * Traduction des codes stables de la couche d'intelligence en HTTP. Le
 * corps porte toujours `code` : le web choisit son message sur ce code,
 * jamais sur un texte du backend.
 */
const HTTP_STATUS: Record<ImageGenerationErrorCode, HttpStatus> = {
  INVALID_PROMPT: HttpStatus.BAD_REQUEST,
  UNKNOWN_MODEL: HttpStatus.BAD_REQUEST,
  UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  QUOTA_EXHAUSTED: HttpStatus.SERVICE_UNAVAILABLE,
  NO_IMAGE: HttpStatus.UNPROCESSABLE_ENTITY,
  FAILED: HttpStatus.BAD_GATEWAY,
};

const MESSAGES: Record<ImageGenerationErrorCode, string> = {
  INVALID_PROMPT: 'Le prompt est vide ou trop long.',
  UNKNOWN_MODEL: 'Modele image inconnu.',
  UNAVAILABLE: "La generation d'images n'est pas disponible.",
  QUOTA_EXHAUSTED: "Quota de generation d'images indisponible pour le moment.",
  NO_IMAGE: "Aucune image n'a pu etre generee pour ce prompt.",
  FAILED: "La generation d'image a echoue.",
};

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  async generate(prompt: unknown, model?: string): Promise<KeplerImageResult> {
    try {
      const result = await imageFlow({ prompt: typeof prompt === 'string' ? prompt : '', model });
      return { data: result.data, mimeType: result.mimeType, model: result.model };
    } catch (error) {
      const code: ImageGenerationErrorCode =
        error instanceof ImageGenerationError ? error.code : 'FAILED';
      this.logger.warn(`Kepler Image : echec ${code}`);
      throw new HttpException({ statusCode: HTTP_STATUS[code], code, message: MESSAGES[code] }, HTTP_STATUS[code]);
    }
  }
}
