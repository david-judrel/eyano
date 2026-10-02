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
  `\\b(?:${FR_VERBS})(?:-(?:moi|nous|lui))?\\s+(?:(?:moi|nous)\\s+)?(?:(?:une|un|des|deux|trois|quatre|le|la|les|mon|ma|mes)\\s+|l')(?:\\S+\\s+)?(?:${FR_NOUNS})\\b`
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

// ----------------------------------------------------- fautes de frappe

/** Mots-cles corriges s'ils sont mal tapes (une lettre de difference). */
const TYPO_TARGETS = [
  'image', 'images', 'photo', 'photos', 'dessin', 'dessins', 'illustration', 'illustrations',
  'affiche', 'affiches', 'portrait', 'portraits', 'visuel', 'visuels',
  'picture', 'pictures', 'drawing', 'drawings',
  'genere', 'generer', 'dessine', 'dessiner', 'realise', 'realiser', 'illustre', 'illustrer',
  'generate', 'create',
  'retire', 'retirer', 'enleve', 'enlever', 'ajoute', 'ajouter', 'change', 'changer',
  'modifie', 'modifier', 'refais', 'refaire', 'realiste',
];
/** Vrais mots proches d'un mot-cle : jamais corriges. */
const NOT_TYPOS = new Set(['mage', 'mages', 'photon', 'photons', 'produit', 'dessous', 'genie']);

/** Distance d'edition avec transposition (une inversion de lettres = 1). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Determinants mal tapes (mots courts : liste fermee, pas de distance). */
const SHORT_TYPOS: Readonly<Record<string, string>> = { uen: 'une', eun: 'une', dse: 'des', sed: 'des' };

/** « imag » -> « image », « gnere » -> « genere » : mots d'au moins 4 lettres. */
function correctTypos(text: string): string {
  const fixed = text.replace(/\b[a-z]{2,3}\b/g, (word) => SHORT_TYPOS[word] ?? word);
  return fixed.replace(/[a-z]{4,}/g, (word) => {
    if (NOT_TYPOS.has(word) || TYPO_TARGETS.includes(word)) return word;
    const match = TYPO_TARGETS.find(
      (target) => Math.abs(target.length - word.length) <= 1 && editDistance(word, target) === 1
    );
    return match ?? word;
  });
}

/**
 * Vrai si le message demande la GENERATION d'une image. Deterministe et
 * volontairement restrictif : un faux negatif laisse le chat repondre
 * normalement, un faux positif enverrait une conversation au moteur image.
 */
export function detectImageRequest(raw: string): boolean {
  if (typeof raw !== 'string') return false;
  const text = correctTypos(normalize(raw));
  if (META_QUESTION.test(text)) return false;
  return FR_REQUEST.test(text) || EN_REQUEST.test(text) || FR_DRAW.test(text);
}

/** Mode choisi explicitement dans l'interface (« Créer une image »). */
export type ChatMode = 'image';

/**
 * Kepler doit-il traiter ce message ? Drapeau actif ET (mode image choisi
 * par l'utilisateur OU demande d'image detectee dans le texte).
 */
export function shouldUseKepler(
  content: string,
  env: NodeJS.ProcessEnv = process.env,
  mode?: ChatMode
): boolean {
  if (!isKeplerImageEnabled(env)) return false;
  return mode === 'image' || detectImageRequest(content);
}

/** Reponse d'Eyano pour chaque echec stable du moteur image. */
export function keplerFailureText(code: string): string {
  switch (code) {
    case 'QUOTA_EXHAUSTED':
      return "Je ne peux pas générer d'image pour le moment : l'accès à la génération d'images n'est pas disponible (quota du modèle). Réessaie un peu plus tard.";
    case 'NO_IMAGE':
      return "Je n'ai pas réussi à produire d'image pour cette demande. Tu peux essayer de la reformuler ?";
    case 'INVALID_PROMPT':
      return "Je n'ai pas pu utiliser ta demande : la description est trop longue, ou l'image jointe n'est pas au bon format (PNG, JPEG ou WebP, 10 Mo maximum).";
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
  plan: KeplerPlan | string,
  messageId: string,
  deps: { generate: typeof imageFlow; db: typeof prisma } = { generate: imageFlow, db: prisma }
): Promise<KeplerChatOutcome> {
  const { prompt, sourceImage } = await resolvePlan(typeof plan === 'string' ? { prompt: plan } : plan, deps.db);

  let result: { data: string; mimeType: string };
  try {
    result = await deps.generate(sourceImage ? { prompt, sourceImage } : { prompt });
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

// ------------------------------------------------- suite d'une image (contexte)

/** Message d'historique tel que lu en base (pieces jointes publiques). */
export interface KeplerHistoryMessage {
  role: string;
  content: string;
  attachments?: { id?: string; storageKey?: string | null }[];
}

/** Vrai si ce message d'Eyano porte une image Kepler. */
export function isKeplerImageMessage(message: KeplerHistoryMessage): boolean {
  return message.role === 'assistant' && (message.attachments ?? []).some((a) => a.storageKey === 'db:kepler');
}

/** Nombre maximal de demandes reprises pour une retouche. */
const MAX_THREAD = 4;

/**
 * Demandes de l'utilisateur ayant produit les images les plus recentes, si
 * la DERNIERE reponse d'Eyano est une image (sinon : aucune). Ordre
 * chronologique : la demande d'origine puis ses retouches.
 */
export function imageThread(history: KeplerHistoryMessage[]): string[] {
  const prompts: string[] = [];
  let i = history.length - 1;
  while (i >= 1 && prompts.length < MAX_THREAD) {
    const answer = history[i];
    const request = history[i - 1];
    if (!isKeplerImageMessage(answer) || request.role !== 'user') break;
    prompts.unshift(request.content.trim());
    i -= 2;
  }
  return prompts;
}

/** Indices d'une retouche de l'image precedente. */
const FOLLOW_UP =
  /\b(?:plus|moins|mieux|meilleur|meilleure|refais|refaire|recommence|encore|autre|change|changer|modifie|modifier|ajoute|ajouter|enleve|enlever|retire|retirer|mets|mettre|rends|rendre|version|style|couleur|couleurs|fond|realiste|cartoon|manga|anime|zoom|sourire|lumiere|sombre|clair|jeune|vieux|vieille|more|less|better|again|another|change|add|remove|make it)\b/;
/** Vraies questions ou remerciements : la conversation reprend. */
const NOT_FOLLOW_UP =
  /\b(?:merci|qui|pourquoi|comment|quel|quelle|quels|quelles|explique|expliquer|raconte|resume|traduis|ecris|redige|thanks|who|why|how|what|explain|write)\b/;
const MAX_FOLLOW_UP_WORDS = 25;

/** Vrai si le message, juste apres une image, demande de la retoucher. */
export function detectImageFollowUp(raw: string): boolean {
  if (typeof raw !== 'string') return false;
  const text = correctTypos(normalize(raw)).trim();
  if (!text || text.split(/\s+/).length > MAX_FOLLOW_UP_WORDS) return false;
  if (NOT_FOLLOW_UP.test(text)) return false;
  return FOLLOW_UP.test(text) || /^(?:avec|sans|with|without)\b/.test(text);
}

/** Longueur maximale d'un prompt d'image (limite du moteur). */
const MAX_PROMPT = 2000;

/** Prompt d'une retouche : la demande d'origine, ses retouches, la nouvelle. */
export function buildFollowUpPrompt(thread: string[], content: string): string {
  const [origin, ...edits] = thread;
  const parts = [origin, ...edits, content.trim()].filter(Boolean);
  const prompt =
    parts.length === 1
      ? parts[0]
      : `${parts[0]}. Modifications demandées, dans l'ordre : ${parts.slice(1).join(' ; ')}`;
  return prompt.length > MAX_PROMPT ? prompt.slice(prompt.length - MAX_PROMPT) : prompt;
}

/** Image de depart d'une retouche. */
export type KeplerSource =
  | { kind: 'upload'; image: { data: string; mimeType: string } }
  | { kind: 'previous'; attachmentId: string };

export interface KeplerPlan {
  /** Ce que Kepler doit produire (ou la modification, avec `source`). */
  prompt: string;
  source?: KeplerSource;
  /** Prompt a utiliser si l'image de depart est introuvable. */
  fallbackPrompt?: string;
}

/** Piece jointe Kepler de la derniere reponse d'Eyano, si c'est une image. */
function lastKeplerAttachmentId(history: KeplerHistoryMessage[]): string | undefined {
  const last = history[history.length - 1];
  if (!last || !isKeplerImageMessage(last)) return undefined;
  return last.attachments?.find((a) => a.storageKey === 'db:kepler')?.id;
}

/**
 * Decide si Kepler traite ce message, et comment.
 *   - photo jointe + demande d'image ou de retouche : retouche de la photo ;
 *   - retouche juste apres une image : retouche de cette image ;
 *   - nouvelle demande d'image (texte ou mode image) : creation ;
 *   - sinon : `null`, le chat repond (une photo seule est analysee).
 */
export function planKepler(
  content: string,
  history: KeplerHistoryMessage[],
  mode?: ChatMode,
  env: NodeJS.ProcessEnv = process.env,
  images?: { data: string; mimeType: string }[]
): KeplerPlan | null {
  if (!isKeplerImageEnabled(env)) return null;

  const fresh = detectImageRequest(content);
  const followUp = detectImageFollowUp(content);

  const uploaded = images?.[0];
  if (uploaded && (mode === 'image' || fresh || followUp)) {
    return { prompt: content, source: { kind: 'upload', image: uploaded } };
  }

  const thread = imageThread(history);
  if (thread.length > 0 && !fresh && followUp) {
    const fallbackPrompt = buildFollowUpPrompt(thread, content);
    const attachmentId = lastKeplerAttachmentId(history);
    return attachmentId
      ? { prompt: content, source: { kind: 'previous', attachmentId }, fallbackPrompt }
      : { prompt: fallbackPrompt };
  }

  if (mode === 'image' || fresh) {
    return { prompt: content };
  }
  return null;
}

/**
 * Consigne ajoutee au chat quand Kepler est actif : Eyano sait creer des
 * images ; le chat ne doit jamais pretendre le contraire.
 */
export function keplerChatNote(env: NodeJS.ProcessEnv = process.env): string {
  if (!isKeplerImageEnabled(env)) return '';
  return [
    '',
    '',
    "Création d'images : tu SAIS créer des images grâce à Kepler, ton module d'images.",
    "Les messages marqués « [Image créée par Kepler] » dans l'historique sont des images que tu as réellement créées.",
    "Ne dis jamais que tu ne peux pas créer d'images. Si l'utilisateur en veut une ou veut retoucher la précédente, invite-le à la décrire avec « génère une image de… » ou à choisir « Créer une image » dans le menu du trombone.",
  ].join('\n');
}

/** Contenu d'un message d'historique tel que le chat doit le voir. */
export function historyContentForChat(message: KeplerHistoryMessage): string {
  return isKeplerImageMessage(message) ? `${message.content} [Image créée par Kepler]` : message.content;
}

/**
 * Image de depart du plan : la photo jointe, ou l'image Kepler precedente lue
 * en base. Introuvable : creation a partir du prompt de repli.
 */
async function resolvePlan(
  plan: KeplerPlan,
  db: typeof prisma
): Promise<{ prompt: string; sourceImage?: { data: string; mimeType: string } }> {
  const source = plan.source;
  if (!source) return { prompt: plan.prompt };
  if (source.kind === 'upload') return { prompt: plan.prompt, sourceImage: source.image };

  const previous = await db.attachment
    .findUnique({ where: { id: source.attachmentId }, select: { data: true, mimeType: true } })
    .catch(() => null);
  if (previous?.data) {
    return {
      prompt: plan.prompt,
      sourceImage: { data: Buffer.from(previous.data).toString('base64'), mimeType: previous.mimeType },
    };
  }
  return { prompt: plan.fallbackPrompt ?? plan.prompt };
}
