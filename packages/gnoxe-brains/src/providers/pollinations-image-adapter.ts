import {
  ImageGenerationError,
  ImageRequest,
  ImageResponse,
  ProviderCapabilities,
} from './model-provider';
import { resolveLogicalImageModel } from './model-registry';

/**
 * Kepler Image, second transport : generation d'images par une API HTTP
 * publique (prototype). Meme contrat que le transport principal : echecs
 * toujours en `ImageGenerationError` a code stable, aucun detail brut du
 * backend ne remonte.
 *
 * Active seulement par `KEPLER_IMAGE_BACKEND=pollinations` (voir bootstrap).
 */

const ENDPOINT = 'https://gen.pollinations.ai/image/';
/** Retouche d'une image existante (multipart, reponse JSON en base64). */
const EDIT_ENDPOINT = 'https://gen.pollinations.ai/v1/images/edits';
/** Modele de retouche : garde le sujet et le decor, applique la consigne. */
const EDIT_MODEL = 'flux-klein';

/** Identifiant logique -> modele de ce backend. */
const MODEL_BACKEND: Readonly<Record<string, string>> = Object.freeze({
  'kepler-image-1': 'zimage',
});

const IMAGE_SIZE = 1024;
const TIMEOUT_MS = 90_000;

export class PollinationsImageAdapter {
  readonly name = 'pollinations';

  constructor(
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly apiKey: () => string | undefined = () => process.env.POLLINATIONS_API_KEY?.trim() || undefined
  ) {}

  capabilities(): ProviderCapabilities {
    return { streaming: false, structuredOutput: false, images: false, imageGeneration: true, models: [] };
  }

  async generateImage(request: ImageRequest): Promise<ImageResponse> {
    const logical = resolveLogicalImageModel(request.model);
    const modelName = logical ? MODEL_BACKEND[logical] : undefined;
    if (!logical || !modelName) {
      throw new ImageGenerationError('UNKNOWN_MODEL', `Modele image inconnu : "${request.model}".`);
    }

    const key = this.apiKey();
    if (!key) {
      throw new ImageGenerationError('UNAVAILABLE', "Aucune cle configuree pour la generation d'images.");
    }

    if (request.sourceImage) {
      return this.editImage(request.prompt, request.sourceImage, key, logical);
    }

    const params = new URLSearchParams({
      model: modelName,
      width: String(IMAGE_SIZE),
      height: String(IMAGE_SIZE),
      safe: 'true',
      nologo: 'true',
    });
    const url = `${ENDPOINT}${encodeURIComponent(request.prompt)}?${params}`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ImageGenerationError('FAILED', "La generation d'image a echoue.");
    }

    if (!response.ok) {
      throw new ImageGenerationError(codeForStatus(response.status), `Generation refusee (HTTP ${response.status}).`);
    }

    const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!mimeType.startsWith('image/')) {
      throw new ImageGenerationError('NO_IMAGE', 'Aucune image produite.');
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new ImageGenerationError('NO_IMAGE', 'Aucune image produite.');
    }

    return { data: bytes.toString('base64'), mimeType, model: logical, provider: this.name };
  }

  /** Retouche : l'image de depart et la consigne, une image en retour. */
  private async editImage(
    prompt: string,
    source: { data: string; mimeType: string },
    key: string,
    logical: string
  ): Promise<ImageResponse> {
    const form = new FormData();
    form.append('model', EDIT_MODEL);
    form.append('prompt', prompt);
    form.append('image', new Blob([Buffer.from(source.data, 'base64')], { type: source.mimeType }), 'source');

    let response: Response;
    try {
      response = await this.fetchImpl(EDIT_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ImageGenerationError('FAILED', "La retouche de l'image a echoue.");
    }

    if (!response.ok) {
      throw new ImageGenerationError(codeForStatus(response.status), `Retouche refusee (HTTP ${response.status}).`);
    }

    let data: string | undefined;
    try {
      const body: any = await response.json();
      data = body?.data?.[0]?.b64_json;
    } catch {
      data = undefined;
    }
    if (typeof data !== 'string' || data.length === 0) {
      throw new ImageGenerationError('NO_IMAGE', 'Aucune image produite.');
    }

    return { data, mimeType: sniffMimeType(data), model: logical, provider: this.name };
  }
}

/** Statut HTTP -> code stable. */
function codeForStatus(status: number): 'QUOTA_EXHAUSTED' | 'UNAVAILABLE' | 'NO_IMAGE' | 'FAILED' {
  if (status === 402 || status === 429) return 'QUOTA_EXHAUSTED';
  if (status === 401 || status === 403) return 'UNAVAILABLE';
  if (status === 400 || status === 422) return 'NO_IMAGE';
  return 'FAILED';
}

/** Type d'une image base64 d'apres sa signature (JPEG par defaut). */
function sniffMimeType(base64: string): string {
  const head = Buffer.from(base64.slice(0, 16), 'base64');
  if (head[0] === 0x89 && head[1] === 0x50) return 'image/png';
  if (head.toString('ascii', 0, 4) === 'RIFF') return 'image/webp';
  return 'image/jpeg';
}
