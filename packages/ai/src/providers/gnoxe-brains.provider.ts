import { ChatMessage } from '@eyano/types';
import { AIProvider, GenerateOptions } from './ai-provider';
import { GeminiProvider } from './gemini.provider';

export class GnoxeBrainsProvider implements AIProvider {
  name = 'gnoxe-brains';

  private geminiProvider = new GeminiProvider();

  async generate(messages: ChatMessage[], options?: GenerateOptions): Promise<string> {
    const mappedModel = this.mapModel(options?.model);
    return this.geminiProvider.generate(messages, { ...options, model: mappedModel });
  }

  async *stream(messages: ChatMessage[], options?: GenerateOptions): AsyncIterable<string> {
    const mappedModel = this.mapModel(options?.model);
    yield* this.geminiProvider.stream(messages, { ...options, model: mappedModel });
  }

  private mapModel(model?: string): string {
    switch (model) {
      case 'gnoxe-brains-1':
        return 'googleai/gemini-1.5-flash';
      case 'gnoxe-brains-1.5':
        return 'googleai/gemini-1.5-pro';
      default:
        return 'googleai/gemini-1.5-flash';
    }
  }
}
