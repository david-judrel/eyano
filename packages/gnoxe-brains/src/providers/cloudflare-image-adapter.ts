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

/** Une paire d'identifiants (compte + jeton). */
export interface CloudflareCredential {
  accountId: string;
  token: string;
}

export interface CloudflareConfig {
  /** Paires essayees dans l'ordre ; prioritaire sur `accountId`/`token`. */
  credentials?: CloudflareCredential[];
  accountId?: string;
  token?: string;
  model?: string;
}

/** Nombre maximal de paires numerotees lues dans l'environnement. */
const MAX_NUMBERED = 20;
/** Pause apres « capacite temporairement indisponible » (3040). */
const CAPACITY_PAUSE_MS = 60_000;
/** Pause apres un refus d'acces (jeton invalide, compte bloque). */
const DENIED_PAUSE_MS = 60 * 60_000;

/**
 * Paires lues dans l'environnement : `CLOUDFLARE_ACCOUNT_ID` /
 * `CLOUDFLARE_API_TOKEN` d'abord, puis `_1` ... `_20`. Une paire incomplete
 * est ignoree ; un doublon n'est garde qu'une fois.
 */
export function readCloudflareCredentials(env: NodeJS.ProcessEnv = process.env): CloudflareCredential[] {
  const pairs: CloudflareCredential[] = [];
  const push = (accountId?: string, token?: string) => {
    const a = accountId?.trim().replace(/^["']|["']$/g, '');
    const t = token?.trim().replace(/^["']|["']$/g, '');
    if (a && t && !pairs.some((p) => p.accountId === a && p.token === t)) pairs.push({ accountId: a, token: t });
  };
  push(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_API_TOKEN);
  for (let i = 1; i <= MAX_NUMBERED; i++) {
    push(env[`CLOUDFLARE_ACCOUNT_ID_${i}`], env[`CLOUDFLARE_API_TOKEN_${i}`]);
  }
  return pairs;
}

/** Prochain minuit UTC : remise a zero du quota quotidien. */
function nextUtcMidnight(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export class CloudflareImageAdapter {
  readonly name = 'cloudflare';

  /** Paires en pause : cle interne -> fin de la pause (ms). */
  private readonly pausedUntil = new Map<string, number>();

  constructor(
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
    private readonly config: () => CloudflareConfig = () => ({
      credentials: readCloudflareCredentials(),
      model: process.env.KEPLER_CLOUDFLARE_MODEL?.trim() || undefined,
    }),
    private readonly now: () => number = () => Date.now()
  ) {}

  /** Nombre de paires configurees et nombre en pause (sans aucun secret). */
  status(): { configured: number; paused: number } {
    const credentials = this.credentials();
    const now = this.now();
    const paused = credentials.filter((c) => (this.pausedUntil.get(keyOf(c)) ?? 0) > now).length;
    return { configured: credentials.length, paused };
  }

  private credentials(): CloudflareCredential[] {
    const config = this.config();
    if (config.credentials) return config.credentials;
    return config.accountId && config.token ? [{ accountId: config.accountId, token: config.token }] : [];
  }

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

    const credentials = this.credentials();
    if (credentials.length === 0) {
      throw new ImageGenerationError('UNAVAILABLE', "Aucun identifiant configure pour la generation d'images.");
    }

    const modelId = this.config().model ?? DEFAULT_MODEL;
    // FLUX refuse toute propriete inconnue (taille fixe) ; SD accepte la taille.
    const body = /flux/i.test(modelId)
      ? { prompt: request.prompt }
      : { prompt: request.prompt, width: IMAGE_SIZE, height: IMAGE_SIZE };

    // Bascule : chaque paire disponible est essayee dans l'ordre. Quota du
    // jour epuise, capacite saturee ou acces refuse -> pause, paire suivante.
    let lastSkip: 'QUOTA_EXHAUSTED' | 'UNAVAILABLE' = 'UNAVAILABLE';
    for (const credential of credentials) {
      const key = keyOf(credential);
      if ((this.pausedUntil.get(key) ?? 0) > this.now()) {
        lastSkip = 'QUOTA_EXHAUSTED';
        continue;
      }

      const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credential.accountId)}/ai/run/${modelId}`;
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${credential.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        throw new ImageGenerationError('FAILED', "La generation d'image a echoue.");
      }

      if (response.status === 429) {
        const daily = (await errorCodes(response)).includes(3036);
        this.pausedUntil.set(key, daily ? nextUtcMidnight(this.now()) : this.now() + CAPACITY_PAUSE_MS);
        lastSkip = 'QUOTA_EXHAUSTED';
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        this.pausedUntil.set(key, this.now() + DENIED_PAUSE_MS);
        continue;
      }
      if (!response.ok) {
        throw new ImageGenerationError(codeForStatus(response.status), `Generation refusee (HTTP ${response.status}).`);
      }
      return this.readImage(response, logical);
    }

    throw new ImageGenerationError(
      lastSkip,
      lastSkip === 'QUOTA_EXHAUSTED'
        ? "Quota de generation d'images atteint pour tous les identifiants."
        : "Aucun identifiant utilisable pour la generation d'images."
    );
  }

  /** Image de la reponse : brute (SDXL) ou JSON `{ result: { image } }` (FLUX). */
  private async readImage(response: Response, logical: string): Promise<ImageResponse> {
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

/** Cle interne d'une paire (jamais journalisee ni exposee). */
function keyOf(credential: CloudflareCredential): string {
  return `${credential.accountId}:${credential.token}`;
}

/** Codes d'erreur internes de la reponse (`errors[].code`), sinon vide. */
async function errorCodes(response: Response): Promise<number[]> {
  try {
    const body: any = await response.json();
    return Array.isArray(body?.errors) ? body.errors.map((e: any) => Number(e?.code)) : [];
  } catch {
    return [];
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
