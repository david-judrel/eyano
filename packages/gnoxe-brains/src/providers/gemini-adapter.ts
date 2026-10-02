import { ChatMessage } from '@eyano/types';
import {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelChunk,
  ProviderCapabilities,
  ImageRequest,
  ImageResponse,
  ImageGenerationError,
} from './model-provider';
import {
  resolveBackendModel,
  resolveLogicalModel,
  listRegisteredModels,
  resolveBackendImageModel,
  resolveLogicalImageModel,
} from './model-registry';
import { GeminiKeyManager } from './gemini-key-manager';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Initialize key manager with environment variables
function initializeKeyManager(): GeminiKeyManager {
  const apiKeys = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter((key): key is string => Boolean(key && key.trim()));

  // Fallback to legacy GEMINI_API_KEY if no numbered keys are set
  if (apiKeys.length === 0 && process.env.GEMINI_API_KEY) {
    apiKeys.push(process.env.GEMINI_API_KEY);
  }

  const cooldownMs = parseInt(process.env.GEMINI_COOLDOWN_MS || '60000', 10);
  return new GeminiKeyManager(apiKeys, cooldownMs);
}

// Singleton key manager
let keyManagerInstance: GeminiKeyManager | null = null;

function getKeyManager(): GeminiKeyManager {
  if (!keyManagerInstance) {
    keyManagerInstance = initializeKeyManager();
  }
  return keyManagerInstance;
}

function buildParts(message: ChatMessage) {
  const parts: any[] = [{ text: message.content }];
  if (message.images && message.images.length > 0) {
    for (const img of message.images) {
      parts.push({
        inline_data: {
          mime_type: img.mimeType,
          data: img.data,
        },
      });
    }
  }
  return parts;
}

/**
 * L'adapter est un transport technique : il ne construit AUCUN prompt
 * et n'a aucune connaissance de la marque EYANO.
 *
 * Les messages `role: 'system'` sont fournis par la couche superieure
 * (prompts/eyano.system -> buildChatContext) et transmis en `system_instruction`,
 * comme l'exige l'API Gemini. Aucun message n'est perdu.
 */
function buildRequestPayload(request: ModelRequest) {
  const { messages } = request;
  const systemMessages = messages.filter((m) => m.role === 'system');
  const conversation = messages.filter((m) => m.role !== 'system');

  return {
    ...(systemMessages.length > 0
      ? { system_instruction: { parts: systemMessages.map((m) => ({ text: m.content })) } }
      : {}),
    contents: conversation.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: buildParts(m),
    })),
    generationConfig: {
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? 8192,
    },
  };
}

/** Kepler Image : prompt seul, reponse texte et image. */
function buildImagePayload(prompt: string) {
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('429') ||
    message.toLowerCase().includes('quota') ||
    message.toLowerCase().includes('rate limit') ||
    message.toLowerCase().includes('resource exhausted')
  );
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {}
  }

  throw new Error('Sortie JSON invalide.');
}

/**
 * Adapter concret vers l'API Gemini.
 * Implemente `ModelProvider` : c'est le seul point du code qui connait Google.
 */
export class GeminiAdapter implements ModelProvider {
  readonly name = 'gemini';

  /**
   * Appel `generateContent` avec rotation des cles, partage par `generate`
   * (texte) et `generateImage` (Kepler Image). Rend la reponse JSON, ou
   * `null` si toutes les cles ont repondu par un depassement de quota.
   *
   * Politique de 429 :
   *   'cooldown-key' (texte, comportement historique) : la cle est mise en
   *     pause, la limite etant celle de la cle ;
   *   'model-quota' (images) : la cle n'est PAS mise en pause. Le quota
   *     d'un modele image (nul au palier gratuit) ne doit jamais couper le
   *     chat, qui partage les memes cles.
   */
  private async callGenerateContent(
    modelName: string,
    payload: unknown,
    policy: 'cooldown-key' | 'model-quota'
  ): Promise<any | null> {
    const keyManager = getKeyManager();
    const maxAttempts = keyManager.getAvailableCount();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const key = keyManager.getAvailableKey();
      if (!key) {
        throw new Error('Cles API temporairement indisponibles.');
      }

      try {
        console.log(`[provider] cle ${key.id} (tentative ${attempt + 1}/${maxAttempts})`);

        const res = await fetch(`${GEMINI_API_URL}/${modelName}:generateContent?key=${key.key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errorText = JSON.stringify(err);

          // Check if it's a rate limit error
          if (res.status === 429 || errorText.includes('quota') || errorText.includes('rate limit')) {
            if (policy === 'cooldown-key') {
              console.warn(`[provider] cle ${key.id} limitee (429)`);
              keyManager.markRateLimited(key.id);
            } else {
              console.warn(`[provider] cle ${key.id} : quota du modele atteint (429), cle conservee`);
            }
            continue; // Try next key
          }

          // For other errors, throw immediately
          throw new Error(`Appel modele en echec : ${res.status} ${errorText}`);
        }

        const data = await res.json();
        keyManager.markSuccess(key.id);
        return data;
      } catch (error) {
        if (isRateLimitError(error)) {
          if (policy === 'cooldown-key') {
            console.warn(`[provider] cle ${key.id} limitee`);
            keyManager.markRateLimited(key.id);
          }
          continue; // Try next key
        }
        throw error; // Re-throw non-rate-limit errors
      }
    }

    return null;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const modelName = resolveBackendModel(request.model);
    const data = await this.callGenerateContent(modelName, buildRequestPayload(request), 'cooldown-key');

    if (data === null) {
      throw new Error('Aucune cle API disponible apres rotation.');
    }

    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      model: resolveLogicalModel(request.model),
      provider: this.name,
    };
  }

  /**
   * Kepler Image : meme transport que `generate`, reponse en image. Les
   * echecs sont TOUJOURS des `ImageGenerationError` a code stable ; le
   * detail brut du backend ne remonte jamais.
   */
  async generateImage(request: ImageRequest): Promise<ImageResponse> {
    const logical = resolveLogicalImageModel(request.model);
    const modelName = resolveBackendImageModel(request.model);
    if (!logical || !modelName) {
      throw new ImageGenerationError('UNKNOWN_MODEL', `Modele image inconnu : "${request.model}".`);
    }

    let data: any;
    try {
      data = await this.callGenerateContent(modelName, buildImagePayload(request.prompt), 'model-quota');
    } catch {
      throw new ImageGenerationError('FAILED', "La generation d'image a echoue.");
    }

    if (data === null) {
      throw new ImageGenerationError(
        'QUOTA_EXHAUSTED',
        "Quota de generation d'images atteint ou indisponible pour toutes les cles."
      );
    }

    const candidate = data.candidates?.[0];
    const part = (candidate?.content?.parts ?? []).find(
      (entry: any) => entry?.inlineData?.data || entry?.inline_data?.data
    );
    if (!part) {
      const reason = candidate?.finishReason ?? data.promptFeedback?.blockReason;
      throw new ImageGenerationError('NO_IMAGE', `Aucune image produite${reason ? ` (${reason})` : ''}.`);
    }

    const inline = part.inlineData ?? part.inline_data;
    return {
      data: inline.data,
      mimeType: inline.mimeType ?? inline.mime_type ?? 'image/png',
      model: logical,
      provider: this.name,
    };
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelChunk> {
    const keyManager = getKeyManager();
    const modelName = resolveBackendModel(request.model);
    const logicalModel = resolveLogicalModel(request.model);
    const maxAttempts = keyManager.getAvailableCount();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const key = keyManager.getAvailableKey();
      if (!key) {
        throw new Error('Cles API temporairement indisponibles.');
      }

      try {
        console.log(`[provider] cle ${key.id} pour le flux (tentative ${attempt + 1}/${maxAttempts})`);

        const res = await fetch(`${GEMINI_API_URL}/${modelName}:streamGenerateContent?alt=sse&key=${key.key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildRequestPayload(request)),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errorText = JSON.stringify(err);

          if (res.status === 429 || errorText.includes('quota') || errorText.includes('rate limit')) {
            console.warn(`[provider] cle ${key.id} limitee pendant le flux (429)`);
            keyManager.markRateLimited(key.id);
            continue;
          }

          throw new Error(`Appel modele en echec : ${res.status} ${errorText}`);
        }

        keyManager.markSuccess(key.id);

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  fullResponse += text;
                  yield { type: 'text', content: text };
                }
              } catch {}
            }
          }
        }

        yield { type: 'done', content: fullResponse, model: logicalModel };
        return; // Success, exit the attempt loop
      } catch (error) {
        if (isRateLimitError(error)) {
          console.warn(`[provider] cle ${key.id} limitee pendant le flux`);
          keyManager.markRateLimited(key.id);
          continue;
        }
        throw error;
      }
    }

    throw new Error('Aucune cle API disponible apres rotation pour le flux.');
  }

  async structuredOutput(request: ModelRequest): Promise<unknown> {
    const response = await this.generate({
      ...request,
      temperature: request.temperature ?? 0,
    });
    return extractJson(response.content);
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      structuredOutput: true,
      images: true,
      imageGeneration: true,
      models: listRegisteredModels(),
    };
  }
}

// Export key manager for status monitoring
export { getKeyManager };
