import { imageFlow, ImageGenerationError } from '@eyano/gnoxe-brains';
import { prisma } from '../../lib/prisma';
import { isKeplerImageEnabled } from './kepler-flag';

/**
 * Kepler Image dans le chat (experimental).
 *
 * Une demande d'image dans une conversation ne passe pas par le modele de
 * conversation : elle est detectee ici, de facon deterministe, puis confiee
 * au moteur image (`imageFlow`). L'image est conservee en base comme piece
 * jointe du message d'Eyano, et la reponse texte d'Eyano l'accompagne.
 */

/** Taille maximale d'une image conservee (octets). */
export const MAX_KEPLER_IMAGE_BYTES = 8 * 1024 * 1024;

/** Description publique d'une image jointe (jamais les octets). */
export interface KeplerChatAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface KeplerChatOutcome {
  /** Texte de la reponse d'Eyano, toujours present. */
  text: string;
  /** Image enregistree, en cas de succes uniquement. */
  attachment?: KeplerChatAttachment;
  /** Code d'echec stable, en cas d'echec uniquement. */
  code?: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’ʼ]/g, "'");
}

const FR_VERBS =
  'genere|generer|generes|genre|gener|cree|creer|crees|dessine|dessiner|fais|faire|fait|produis|produire|realise|realiser|illustre|illustrer|imagine|imaginer';
const FR_NOUNS =
  "image|images|illustration|illustrations|dessin|dessins|photo|photos|affiche|affiches|logo|logos|visuel|visuels|portrait|portraits|fond d'ecran|wallpaper";
const EN_VERBS = 'generate|create|draw|make|paint|render|design';
const EN_NOUNS = 'image|images|picture|pictures|illustration|illustrations|drawing|drawings|poster|posters|logo|logos|photo|photos|portrait|portraits|wallpaper';

/** Verbe (eventuellement -moi), determinant, au plus un mot, puis l'objet. */
const FR_REQUEST = new RegExp(
  `\\b(?:${FR_VERBS})(?:-(?:moi|nous|lui))?\\s+(?:(?:moi|nous)\\s+)?(?:une|un|des|deux|trois|quatre)\\s+(?:\\S+\\s+)?(?:${FR_NOUNS})\\b`
);
const EN_REQUEST = new RegExp(
  `\\b(?:${EN_VERBS})\\s+(?:me\\s+|us\\s+)?(?:an?|some|two|three|\\d+)\\s+(?:\\S+\\s+)?(?:${EN_NOUNS})\\b`
);
/** « Dessine-moi un mouton » : l'imperatif suffit. */
const FR_DRAW = /\bdessine-(?:moi|nous)\b/;
/**
 * Questions sur la methode : pas une demande. « Peux-tu… », « tu peux… »,
 * « can you… » restent des demandes (formulation polie la plus courante).
 */
const META_QUESTION = /^\s*(?:comment|pourquoi|how|why)\b/;

/**
 * Vrai si le message demande la GENERATION d'une image. Deterministe et
 * volontairement restrictif : un faux negatif laisse le chat repondre
 * normalement, un faux positif enverrait une conversation au moteur image.
 */
export function detectImageRequest(raw: string): boolean {
  if (typeof raw !== 'string') return false;
  const text = normalize(raw);
  if (META_QUESTION.test(text)) return false;
  return FR_REQUEST.test(text) || EN_REQUEST.test(text) || FR_DRAW.test(text);
}

/** Kepler doit-il traiter ce message ? (drapeau ET demande d'image) */
export function shouldUseKepler(content: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return isKeplerImageEnabled(env) && detectImageRequest(content);
}

/** Reponse d'Eyano pour chaque echec stable du moteur image. */
export function keplerFailureText(code: string): string {
  switch (code) {
    case 'QUOTA_EXHAUSTED':
      return "Je ne peux pas générer d'image pour le moment : l'accès à la génération d'images n'est pas disponible (quota du modèle). Réessaie un peu plus tard.";
    case 'NO_IMAGE':
      return "Je n'ai pas réussi à produire d'image pour cette demande. Tu peux essayer de la reformuler ?";
    case 'INVALID_PROMPT':
      return 'Ta description est trop longue pour générer une image. Essaie une version plus courte.';
    case 'TOO_LARGE':
      return "L'image générée est trop volumineuse pour être conservée. Réessaie, éventuellement avec une demande plus simple.";
    case 'UNAVAILABLE':
      return "La génération d'images n'est pas disponible pour le moment.";
    default:
      return "La génération de l'image a échoué. Réessaie dans un instant.";
  }
}

export const KEPLER_SUCCESS_TEXT = "Voici l'image générée.";

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Genere l'image et l'attache au message d'Eyano `messageId`. Ne leve
 * jamais : un echec devient une reponse d'Eyano qui l'explique.
 */
export async function runKeplerInChat(
  prompt: string,
  messageId: string,
  deps: { generate: typeof imageFlow; db: typeof prisma } = { generate: imageFlow, db: prisma }
): Promise<KeplerChatOutcome> {
  let result: { data: string; mimeType: string };
  try {
    result = await deps.generate({ prompt });
  } catch (error) {
    const code = error instanceof ImageGenerationError ? error.code : 'FAILED';
    return { text: keplerFailureText(code), code };
  }

  const bytes = Buffer.from(result.data, 'base64');
  if (bytes.length === 0) {
    return { text: keplerFailureText('NO_IMAGE'), code: 'NO_IMAGE' };
  }
  if (bytes.length > MAX_KEPLER_IMAGE_BYTES) {
    return { text: keplerFailureText('TOO_LARGE'), code: 'TOO_LARGE' };
  }

  const extension = EXTENSIONS[result.mimeType] ?? 'png';
  const attachment = await deps.db.attachment.create({
    data: {
      messageId,
      fileName: `kepler-image.${extension}`,
      mimeType: result.mimeType,
      size: bytes.length,
      storageKey: 'db:kepler',
      data: bytes,
    },
    select: { id: true, fileName: true, mimeType: true, size: true },
  });

  return { text: KEPLER_SUCCESS_TEXT, attachment };
}
