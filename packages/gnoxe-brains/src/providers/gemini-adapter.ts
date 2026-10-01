import { ChatMessage } from '@eyano/types';
import {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelChunk,
  ProviderCapabilities,
} from './model-provider';
import {
  resolveBackendModel,
  resolveLogicalModel,
  listRegisteredModels,
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

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const keyManager = getKeyManager();
    const modelName = resolveBackendModel(request.model);
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
          body: JSON.stringify(buildRequestPayload(request)),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errorText = JSON.stringify(err);

          // Check if it's a rate limit error
          if (res.status === 429 || errorText.includes('quota') || errorText.includes('rate limit')) {
            console.warn(`[provider] cle ${key.id} limitee (429)`);
            keyManager.markRateLimited(key.id);
            continue; // Try next key
          }

          // For other errors, throw immediately
          throw new Error(`Appel modele en echec : ${res.status} ${errorText}`);
        }

        const data = await res.json();
        keyManager.markSuccess(key.id);
        return {
          content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
          model: resolveLogicalModel(request.model),
          provider: this.name,
        };
      } catch (error) {
        if (isRateLimitError(error)) {
          console.warn(`[provider] cle ${key.id} limitee`);
          keyManager.markRateLimited(key.id);
          continue; // Try next key
        }
        throw error; // Re-throw non-rate-limit errors
      }
    }

    throw new Error('Aucune cle API disponible apres rotation.');
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
      models: listRegisteredModels(),
    };
  }
}

// Export key manager for status monitoring
export { getKeyManager };
