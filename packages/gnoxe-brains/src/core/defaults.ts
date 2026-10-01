import { Agent } from '../agents/agent';
import { ResearchAgent } from '../agents/research.agent';
import { AnalysisAgent } from '../agents/analysis.agent';
import { VerificationAgent } from '../agents/verification.agent';
import { WriterAgent } from '../agents/writer.agent';
import { MissionEngine } from '../missions/mission-engine';
import { MissionExecutor } from '../missions/mission-executor';
import { ToolRegistry, toolRegistry as defaultToolRegistry } from '../tools/registry';
import { ensureToolsRegistered } from '../tools/bootstrap';
import { getModelProvider } from '../providers/bootstrap';
import { ModelProvider } from '../providers/model-provider';
import { Orchestrator } from '../orchestrator/orchestrator';
import { PlanBuilder } from '../orchestrator/planner';
import { MissionObserver } from '../observability/observer';

/**
 * Racine de composition de GnoxeBrains.
 *
 * SEUL endroit du package qui assemble simultanement un `ModelProvider`,
 * les Agents et les Tools. `core/gnoxe-brains.ts` ne voit que le contrat
 * `MissionExecutor` ; `orchestrator/` ne voit ni le provider ni les agents
 * concrets au-dela de leur contrat.
 *
 * Le provider n'est resolu que si aucun agent n'est injecte : un appelant
 * qui fournit ses propres agents ne touche jamais au backend reel.
 */
export interface DefaultExecutorOptions {
  engine: MissionEngine;
  /** Agents fournis par l'appelant (tests, agents metier). */
  agents?: Agent[];
  /** Registre de tools ; le registry global est utilise par defaut. */
  toolRegistry?: ToolRegistry;
  /** Planificateur ; le planificateur deterministe est utilise par defaut. */
  planBuilder?: PlanBuilder;
  /** ModelProvider ; le provider actif du registry est utilise par defaut. */
  modelProvider?: ModelProvider;
  /** Observateur operationnel ; celui de l'`engine` est utilise par defaut. */
  observer?: MissionObserver;
}

/**
 * Resout le `ModelProvider` actif.
 *
 * Point de composition : c'est l'unique passerelle vers le backend pour tout
 * le code qui n'est pas un adapter. Resolu a chaque appel afin qu'un changement
 * de provider actif soit immediatement reflete.
 */
export function resolveDefaultModelProvider(): ModelProvider {
  return getModelProvider();
}

/** Instancie le pipeline standard : recherche, analyse, verification, redaction. */
export function createDefaultAgents(
  registry?: ToolRegistry,
  modelProvider?: ModelProvider,
  observer?: MissionObserver
): Agent[] {
  const target = registry ?? defaultToolRegistry;
  if (target === defaultToolRegistry) {
    ensureToolsRegistered();
  }

  const deps = {
    modelProvider: modelProvider ?? getModelProvider(),
    toolRegistry: target,
    observer,
  };
  return [
    new ResearchAgent(deps),
    new AnalysisAgent(deps),
    new VerificationAgent(deps),
    new WriterAgent(deps),
  ];
}

/**
 * Assemble l'Orchestrator par defaut : `GnoxeBrains -> MissionEngine -> Agents`.
 *
 * L'observation est partagee : l'observateur resolu ici est celui de l'engine,
 * de sorte que les evenements `mission`, `step`, `agent` et `tool` d'une meme
 * execution arrivent tous au meme observateur.
 */
export function createDefaultExecutor(options: DefaultExecutorOptions): MissionExecutor {
  const registry = options.toolRegistry ?? defaultToolRegistry;
  const observer = options.observer ?? options.engine.getObserver();
  const agents =
    options.agents ??
    createDefaultAgents(options.toolRegistry, options.modelProvider, observer);

  return new Orchestrator({
    engine: options.engine,
    agents,
    toolRegistry: registry,
    planBuilder: options.planBuilder,
  });
}
