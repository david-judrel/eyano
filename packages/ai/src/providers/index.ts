export { AIProvider, GenerateOptions } from './ai-provider';
export { GeminiProvider, getKeyManager } from './gemini.provider';
export { GeminiKeyManager, GeminiKey, KeyStatus } from './gemini-key-manager';
export { GnoxeBrainsProvider } from './gnoxe-brains.provider';

import { AIProvider, GenerateOptions } from './ai-provider';
import { GnoxeBrainsProvider } from './gnoxe-brains.provider';

let defaultProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (!defaultProvider) {
    defaultProvider = new GnoxeBrainsProvider();
  }
  return defaultProvider;
}

export function setAIProvider(provider: AIProvider): void {
  defaultProvider = provider;
}
