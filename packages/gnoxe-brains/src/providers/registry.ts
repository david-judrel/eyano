import { ModelProvider } from './model-provider';

/**
 * Registry injectable des ModelProvider.
 *
 * Remplace progressivement le singleton global `getAIProvider()`.
 * L'ordre d'enregistrement est libre : le premier enregistrement devient
 * actif par defaut, puis `setActive()` permet de basculer de backend
 * sans toucher aux agents ni a l'orchestrateur.
 */
export class ProviderRegistry {
  private providers = new Map<string, ModelProvider>();
  private activeId: string | null = null;

  register(id: string, provider: ModelProvider): void {
    this.providers.set(id, provider);
    if (this.activeId === null) {
      this.activeId = id;
    }
  }

  setActive(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`ModelProvider inconnu : ${id}`);
    }
    this.activeId = id;
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  get(id: string): ModelProvider | undefined {
    return this.providers.get(id);
  }

  getActive(): ModelProvider {
    const provider = this.activeId !== null ? this.providers.get(this.activeId) : undefined;
    if (!provider) {
      throw new Error('Aucun ModelProvider enregistre.');
    }
    return provider;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }

  clear(): void {
    this.providers.clear();
    this.activeId = null;
  }
}

export const providerRegistry = new ProviderRegistry();
