import { ChatMessage } from '@eyano/types';
import { AIProvider, GenerateOptions } from './ai-provider';
import { ModelRequest } from './model-provider';
import { getModelProvider } from './bootstrap';

/**
 * @deprecated Faade de compatibilite pendant la migration.
 * Utiliser `getModelProvider()` (abstraction `ModelProvider`) dans le nouveau code.
 *
 * Elle ne connait aucun backend : elle delegue au ModelProvider actif
 * du registry et reconvertit les contrats ancien style.
 */
export class GnoxeBrainsProvider implements AIProvider {
  name = 'gnoxe-brains';

  private toRequest(messages: ChatMessage[], options?: GenerateOptions): ModelRequest {
    return {
      messages,
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    };
  }

  async generate(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    const response = await getModelProvider().generate(this.toRequest(messages, options));
    return response.content;
  }

  async *stream(messages: ChatMessage[], options?: GenerateOptions): AsyncIterable<string> {
    for await (const chunk of getModelProvider().stream(this.toRequest(messages, options))) {
      if (chunk.type === 'text') yield chunk.content;
    }
  }
}
