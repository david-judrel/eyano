/**
 * Kepler Image (experimental) : logique de l'interface, sans React.
 *
 * Le composant n'affiche que cet etat ; toute transition passe par
 * `keplerReducer`, testable sans navigateur. Pret pour un historique plus
 * tard (`GeneratedImage` est l'unite qu'on accumulerait), non developpe ici.
 */

/** Une image generee : base64 et type MIME, telles que rendues par l'API. */
export interface GeneratedImage {
  data: string;
  mimeType: string;
}

export type KeplerStatus = 'idle' | 'loading' | 'done' | 'error';

export interface KeplerState {
  prompt: string;
  status: KeplerStatus;
  image: GeneratedImage | null;
  error: string | null;
}

export type KeplerAction =
  | { type: 'prompt'; value: string }
  | { type: 'submit' }
  | { type: 'success'; image: GeneratedImage }
  | { type: 'failure'; code?: string }
  | { type: 'reset' };

export const MAX_KEPLER_PROMPT_LENGTH = 2000;

export const initialKeplerState: KeplerState = {
  prompt: '',
  status: 'idle',
  image: null,
  error: null,
};

/** Message affiche pour chaque code stable de l'API. */
export function keplerErrorMessage(code?: string): string {
  switch (code) {
    case 'QUOTA_EXHAUSTED':
      return "Kepler Image n'a pas accès à la génération d'images pour le moment (quota du modèle indisponible). Réessayez plus tard.";
    case 'UNAVAILABLE':
      return "La génération d'images n'est pas disponible actuellement.";
    case 'NO_IMAGE':
      return "Aucune image n'a pu être générée pour cette description. Essayez de la reformuler.";
    case 'INVALID_PROMPT':
      return `Décrivez l'image en 1 à ${MAX_KEPLER_PROMPT_LENGTH} caractères.`;
    case 'RATE_LIMITED':
      return 'Trop de demandes rapprochées. Patientez un instant puis réessayez.';
    case 'NETWORK':
      return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
    default:
      return "La génération a échoué. Réessayez dans un instant.";
  }
}

/** Vrai si le prompt peut etre envoye. */
export function canSubmit(state: KeplerState): boolean {
  const length = state.prompt.trim().length;
  return state.status !== 'loading' && length > 0 && length <= MAX_KEPLER_PROMPT_LENGTH;
}

export function keplerReducer(state: KeplerState, action: KeplerAction): KeplerState {
  switch (action.type) {
    case 'prompt':
      return state.status === 'loading' ? state : { ...state, prompt: action.value };
    case 'submit':
      // Pas de double requete ; le prompt est conserve pendant la generation.
      if (!canSubmit(state)) return state;
      return { ...state, status: 'loading', error: null };
    case 'success':
      return state.status === 'loading'
        ? { ...state, status: 'done', image: action.image, error: null }
        : state;
    case 'failure':
      return state.status === 'loading'
        ? { ...state, status: 'error', image: null, error: keplerErrorMessage(action.code) }
        : state;
    case 'reset':
      // Nouvelle image : on garde le prompt pour pouvoir le retoucher.
      return state.status === 'loading' ? state : { ...state, status: 'idle', image: null, error: null };
    default:
      return state;
  }
}

/**
 * Code d'erreur a partir d'une reponse HTTP de l'API. Le corps de l'API
 * porte toujours `code` ; a defaut, le statut suffit.
 */
export function keplerErrorCode(status: number, body: unknown): string {
  const code = (body as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code) return code;
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'UNAVAILABLE';
  return 'FAILED';
}

/** URL affichable et telechargeable d'une image generee. */
export function imageDataUrl(image: GeneratedImage): string {
  return `data:${image.mimeType};base64,${image.data}`;
}

/** Nom de fichier propose au telechargement. */
export function downloadFileName(image: GeneratedImage, now: Date = new Date()): string {
  const extension = image.mimeType.split('/')[1]?.split('+')[0] || 'png';
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `kepler-image-${stamp}.${extension}`;
}
