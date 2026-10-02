import {
  ImageGenerationError,
  ImageRequest,
  ImageResponse,
  ProviderCapabilities,
} from './model-provider';
import { resolveLogicalImageModel } from './model-registry';

/**
 * Kepler Image, transport HTTP vers une API d'inference hebergee (quota
 * gratuit quotidien). Meme contrat que les autres transports : echecs
 * toujours en `ImageGenerationError` a code stable, aucun detail brut du
 * backend ne remonte.
 *
 * Active seulement par `KEPLER_IMAGE_BACKEND=cloudflare` (voir bootstrap).
 */

/** Modele par defaut : SDXL Lightning (gratuit pendant sa beta). */
const DEFAULT_MODEL = '@cf/bytedance/stable-diffusion-xl-lightning';
const IMAGE_SIZE = 1024;
const TIMEOUT_MS = 90_000;

export class CloudflareImageAdapter {
  readonly name = 'cloudflare';

  constructor(
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly config: () => { accountId?: string; token?: string; model?: string } = () => ({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || undefined,
      token: process.env.CLOUDFLARE_API_TOKEN?.trim() || undefined,
      model: process.env.KEPLER_CLOUDFLARE_MODEL?.trim() || undefined,
    })
  ) {}

  capabilities(): ProviderCapabilities {
    return { streaming: false, structuredOutput: false, images: false, imageGeneration: true, models: [] };
  }

  async generateImage(request: ImageRequest): Promise<ImageResponse> {
    const logical = resolveLogicalImageModel(request.model);
    if (!logical) {
      throw new ImageGenerationError('UNKNOWN_MODEL', `Modele image inconnu : "${request.model}".`);
    }
    if (request.sourceImage) {
      throw new ImageGenerationError('UNAVAILABLE', "La retouche d'images n'est pas disponible.");
    }

    const { accountId, token, model } = this.config();
    if (!accountId || !token) {
      throw new ImageGenerationError('UNAVAILABLE', "Aucun identifiant configure pour la generation d'images.");
    }

    const modelId = model ?? DEFAULT_MODEL;
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${modelId}`;
    // FLUX refuse toute propriete inconnue (taille fixe) ; SD accepte la taille.
    const body = /flux/i.test(modelId)
      ? { prompt: request.prompt }
      : { prompt: request.prompt, width: IMAGE_SIZE, height: IMAGE_SIZE };

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ImageGenerationError('FAILED', "La generation d'image a echoue.");
    }

    if (!response.ok) {
      throw new ImageGenerationError(codeForStatus(response.status), `Generation refusee (HTTP ${response.status}).`);
    }

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim();

    // Selon le modele : image brute (SDXL) ou JSON `{ result: { image } }` (FLUX).
    if (contentType.startsWith('image/')) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) throw new ImageGenerationError('NO_IMAGE', 'Aucune image produite.');
      return { data: bytes.toString('base64'), mimeType: contentType, model: logical, provider: this.name };
    }

    let data: string | undefined;
    try {
      const body: any = await response.json();
      data = body?.result?.image;
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
  if (status === 429) return 'QUOTA_EXHAUSTED';
  if (status === 401 || status === 403 || status === 404) return 'UNAVAILABLE';
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
