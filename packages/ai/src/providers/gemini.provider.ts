import { ChatMessage } from '@eyano/types';
import { AIProvider, GenerateOptions } from './ai-provider';
import { EYANO_SYSTEM_PROMPT } from '../prompts/eyano.system';
import { GeminiKeyManager, GeminiKey } from './gemini-key-manager';

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

function getModelName(model?: string): string {
  if (model === 'gnoxe-brains-1.5') return 'gemini-3.6-flash';
  return 'gemini-3.5-flash-lite';
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

function buildContents(messages: ChatMessage[]) {
  const fullMessages = [
    { role: 'system' as const, content: EYANO_SYSTEM_PROMPT },
    ...messages,
  ];

  return fullMessages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: buildParts(m),
    }));
}

function buildSystemInstruction() {
  return { parts: [{ text: EYANO_SYSTEM_PROMPT }] };
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

export class GeminiProvider implements AIProvider {
  name = 'gemini';

  async generate(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    const keyManager = getKeyManager();
    const modelName = getModelName(options?.model);
    const maxAttempts = keyManager.getAvailableCount();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const key = keyManager.getAvailableKey();
      if (!key) {
        throw new Error('Toutes les cles Gemini sont temporairement indisponibles.');
      }

      try {
        console.log(`[Gemini] Using ${key.id} (attempt ${attempt + 1}/${maxAttempts})`);

        const res = await fetch(`${GEMINI_API_URL}/${modelName}:generateContent?key=${key.key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: buildSystemInstruction(),
            contents: buildContents(messages),
            generationConfig: {
              temperature: options?.temperature ?? 0.7,
              maxOutputTokens: options?.maxTokens ?? 8192,
            },
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errorText = JSON.stringify(err);
          
          // Check if it's a rate limit error
          if (res.status === 429 || errorText.includes('quota') || errorText.includes('rate limit')) {
            console.warn(`[Gemini] ${key.id} rate limited (429)`);
            keyManager.markRateLimited(key.id);
            continue; // Try next key
          }
          
          // For other errors, throw immediately
          throw new Error(`Gemini API error: ${res.status} ${errorText}`);
        }

        const data = await res.json();
        keyManager.markSuccess(key.id);
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      } catch (error) {
        if (isRateLimitError(error)) {
          console.warn(`[Gemini] ${key.id} rate limited`);
          keyManager.markRateLimited(key.id);
          continue; // Try next key
        }
        throw error; // Re-throw non-rate-limit errors
      }
    }

    throw new Error('Gemini: aucune cle disponible apres rotation.');
  }

  async *stream(messages: ChatMessage[], options?: GenerateOptions): AsyncIterable<string> {
    const keyManager = getKeyManager();
    const modelName = getModelName(options?.model);
    const maxAttempts = keyManager.getAvailableCount();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const key = keyManager.getAvailableKey();
      if (!key) {
        throw new Error('Toutes les cles Gemini sont temporairement indisponibles.');
      }

      try {
        console.log(`[Gemini] Using ${key.id} for streaming (attempt ${attempt + 1}/${maxAttempts})`);

        const res = await fetch(`${GEMINI_API_URL}/${modelName}:streamGenerateContent?alt=sse&key=${key.key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: buildSystemInstruction(),
            contents: buildContents(messages),
            generationConfig: {
              temperature: options?.temperature ?? 0.7,
              maxOutputTokens: options?.maxTokens ?? 8192,
            },
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errorText = JSON.stringify(err);
          
          if (res.status === 429 || errorText.includes('quota') || errorText.includes('rate limit')) {
            console.warn(`[Gemini] ${key.id} rate limited during streaming (429)`);
            keyManager.markRateLimited(key.id);
            continue;
          }
          
          throw new Error(`Gemini API error: ${res.status} ${errorText}`);
        }

        keyManager.markSuccess(key.id);
        
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

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
                if (text) yield text;
              } catch {}
            }
          }
        }

        return; // Success, exit the attempt loop
      } catch (error) {
        if (isRateLimitError(error)) {
          console.warn(`[Gemini] ${key.id} rate limited during streaming`);
          keyManager.markRateLimited(key.id);
          continue;
        }
        throw error;
      }
    }

    throw new Error('Gemini: aucune cle disponible apres rotation pour le streaming.');
  }
}

// Export key manager for status monitoring
export { getKeyManager };
