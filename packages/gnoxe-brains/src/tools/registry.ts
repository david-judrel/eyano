import { Tool } from './tool';
import { describeError, ObservationEvent } from '../observability/events';
import { ToolExecutionContext, safeObserve } from '../observability/observer';

/**
 * Codes d'erreur du REGISTRE D'OUTILS.
 *
 * Responsabilite unique : defauts de declaration ou de resolution d'un tool.
 * Distinct d'`OrchestratorErrorCode` (execution de mission) et
 * d'`AgentResult.warnings` (limites non bloquantes).
 */
export type ToolRegistryErrorCode = 'DUPLICATE' | 'NOT_FOUND' | 'INVALID_TOOL';

export class ToolRegistryError extends Error {
  constructor(
    readonly code: ToolRegistryErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ToolRegistryError';
  }
}

export interface ToolRegisterOptions {
  /** Autorise le remplacement d'un tool deja enregistre sous le meme nom. */
  override?: boolean;
}

/**
 * Registre des tools, source de verite unique.
 *
 * Independant de tout backend concret, des Agents et de l'Orchestrator :
 * il ne fait qu'associer un identifiant a une implementation.
 * L'extensibilit (WikipediaTool, FileTool, ...) passe par `register()`.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool, options?: ToolRegisterOptions): void {
    this.assertValid(tool);

    if (!options?.override && this.tools.has(tool.name)) {
      throw new ToolRegistryError('DUPLICATE', `Tool deja enregistre : ${tool.name}`);
    }

    this.tools.set(tool.name, tool);
  }

  registerAll(tools: Tool[], options?: ToolRegisterOptions): void {
    for (const tool of tools) {
      this.register(tool, options);
    }
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  size(): number {
    return this.tools.size;
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  clear(): void {
    this.tools.clear();
  }

  /**
   * Resout un tool par son identifiant et l'invoque.
   *
   * `context` est optionnel : sans observateur ou sans identifiant de mission,
   * aucun evenement n'est emis et le comportement historique est preserve.
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    context?: ToolExecutionContext
  ): Promise<string> {
    const { observer, missionId, agentId } = context ?? {};

    const emit = (
      status: ObservationEvent['status'],
      extra: Partial<ObservationEvent> = {}
    ): void => {
      if (!observer || !missionId) return;
      safeObserve(observer, {
        scope: 'tool',
        status,
        missionId,
        agentId,
        toolId: name,
        at: Date.now(),
        ...extra,
      });
    };

    const tool = this.tools.get(name);
    if (!tool) {
      const error = new ToolRegistryError('NOT_FOUND', `Tool inconnu : ${name}`);
      emit('failed', describeError(error));
      throw error;
    }

    const startedAt = Date.now();
    emit('started');

    try {
      const output = await tool.execute(args);
      emit('completed', { durationMs: Date.now() - startedAt });
      return output;
    } catch (error) {
      emit('failed', { durationMs: Date.now() - startedAt, ...describeError(error) });
      throw error;
    }
  }

  private assertValid(tool: Tool): void {
    if (!tool || typeof tool.name !== 'string' || !tool.name.trim()) {
      throw new ToolRegistryError('INVALID_TOOL', 'Un tool doit avoir un nom non vide.');
    }
    if (typeof tool.description !== 'string' || !tool.description.trim()) {
      throw new ToolRegistryError(
        'INVALID_TOOL',
        `Tool "${tool.name}" sans description : impossible a selectionner.`
      );
    }
    if (typeof tool.execute !== 'function') {
      throw new ToolRegistryError('INVALID_TOOL', `Tool "${tool.name}" sans execute().`);
    }
  }
}

export const toolRegistry = new ToolRegistry();
