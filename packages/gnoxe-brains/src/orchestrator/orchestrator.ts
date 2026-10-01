import { Mission, MissionErrorClass, MissionPlan, MissionResult } from '../missions/types';
import { MissionEngine, isTerminalStatus } from '../missions/mission-engine';
import { MissionExecutor } from '../missions/mission-executor';
import { Agent, AgentResult } from '../agents/agent';
import { ToolRegistry } from '../tools/registry';
import { PlanBuilder, PlanStepSpec, buildDeterministicPlan } from './planner';
import { describeError, publicErrorMessage } from '../observability/events';
import { aggregateUsage } from '../observability/usage';

/**
 * Codes d'erreur d'EXECUTION de mission.
 *
 * Responsabilite unique : echecs bloquants detectes par l'Orchestrator, qui
 * terminent la mission en `FAILED`. Distinct de :
 * - `ToolRegistryErrorCode` (defauts du registre d'outils) ;
 * - `GnoxeBrainsErrorCode` (validation d'entree a la facade) ;
 * - `AgentResult.warnings` (limites non bloquantes).
 *
 * Une meme regle produit le meme code quelle que soit la couche qui
 * l'applique ; la classe d'exception porte la distinction de couche.
 */
export type OrchestratorErrorCode =
  | 'INVALID_OBJECTIVE'
  | 'MISSION_TERMINEE'
  | 'PLAN_VIDE'
  | 'AGENT_INVALIDE'
  | 'AGENT_INTROUVABLE'
  | 'TOOL_UNAVAILABLE';

export class OrchestratorError extends Error {
  constructor(
    readonly code: OrchestratorErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

export interface OrchestratorOptions {
  /** Source de verite du cycle de vie. Partagee avec GnoxeBrains. */
  engine: MissionEngine;
  /** Agents candidats. Le plan est filtre sur cette liste. */
  agents: Agent[];
  /** Registre utilise pour valider les tools declares par les agents. */
  toolRegistry?: ToolRegistry;
  /** Planificateur deterministe par defaut. */
  planBuilder?: PlanBuilder;
}

/**
 * Orchestrateur de missions : implementation du contrat `MissionExecutor`.
 *
 * Chainage :
 *   Mission -> PLANNING -> MissionPlan -> MissionStep -> Agent -> AgentResult
 *
 * Bornes :
 * - une execution = un seul passage dans le plan (pas de boucle
 *   "penser / agir / re-penser") ;
 * - pas de re-planification en cours de route ;
 * - le cycle de vie est boucle ici : `COMPLETED` sur succes, `FAILED` sur
 *   erreur, jamais les deux ;
 * - pas de raisonnement prive expose : seules des donnees operationnelles
 *   sont retournees (agentId, durees, tools, warnings) ;
 * - aucune dependance a un provider concret : les agents sont appelles via
 *   leur contrat `Agent`, le modele reste derriere `ModelProvider`.
 */
export class Orchestrator implements MissionExecutor {
  private readonly engine: MissionEngine;
  private readonly agents = new Map<string, Agent>();
  private readonly toolRegistry?: ToolRegistry;
  private readonly planBuilder: PlanBuilder;

  constructor(options: OrchestratorOptions) {
    this.engine = options.engine;
    this.toolRegistry = options.toolRegistry;
    this.planBuilder = options.planBuilder ?? buildDeterministicPlan;

    for (const agent of options.agents ?? []) {
      if (!agent || typeof agent.id !== 'string' || !agent.id.trim()) {
        throw new OrchestratorError('AGENT_INVALIDE', 'Agent sans identifiant non vide.');
      }
      if (this.agents.has(agent.id)) {
        throw new OrchestratorError('AGENT_INVALIDE', `Agent duplique : ${agent.id}.`);
      }
      this.agents.set(agent.id, agent);
    }
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  async execute(mission: Mission): Promise<MissionResult> {
    if (!mission || typeof mission.objective !== 'string' || !mission.objective.trim()) {
      throw this.fail(
        mission,
        new OrchestratorError('INVALID_OBJECTIVE', 'Objectif non vide requis.')
      );
    }
    if (isTerminalStatus(mission.status)) {
      throw this.fail(
        mission,
        new OrchestratorError(
          'MISSION_TERMINEE',
          `Mission deja terminee (${mission.status}) : execution impossible.`
        )
      );
    }

    this.engine.transition(mission, 'PLANNING');
    const plan = this.ensurePlan(mission);

    if (plan.steps.length === 0) {
      throw this.fail(mission, new OrchestratorError('PLAN_VIDE', 'Plan vide : aucune etape a executer.'));
    }

    this.assertToolsAvailable(mission, plan);
    this.engine.transition(mission, 'RUNNING');
    const results = await this.runSteps(mission, plan);

    if (mission.status === 'RUNNING') {
      this.engine.transition(mission, 'VERIFYING');
    }

    const finalized = this.engine.complete(mission, this.buildResult(mission, plan, results));
    return finalized.result as MissionResult;
  }

  // ------------------------------------------------------------------ garanties

  /** Utilise un plan fourni, sinon le construit via le planificateur. */
  private ensurePlan(mission: Mission): MissionPlan {
    const received = mission.plan;
    if (received && received.steps.length > 0) {
      return received;
    }

    const specs: PlanStepSpec[] = this.planBuilder(mission, this.listAgents());
    for (const spec of specs) {
      this.engine.addStep(mission, {
        title: spec.title,
        description: spec.description,
        agentId: spec.agentId,
        toolIds: spec.toolIds,
      });
    }

    if (mission.plan) {
      return mission.plan;
    }

    // Planificateur sans etape : on pose un plan vide explicite plutot que
    // de laisser `mission.plan` a null, afin que l'echec soit observable.
    const empty: MissionPlan = {
      missionId: mission.id,
      objective: mission.objective,
      steps: [],
      createdAt: Date.now(),
    };
    mission.plan = empty;
    return empty;
  }

  /**
   * Controle en amont : tout tool declare par un agent selectionne doit
   * exister dans le registre. On prefere un echec explicite a une
   * degradaison silencieuse du plan.
   */
  private assertToolsAvailable(mission: Mission, plan: MissionPlan): void {
    const registry = this.toolRegistry;
    if (!registry) return;

    for (const step of plan.steps) {
      const agent = step.agentId ? this.agents.get(step.agentId) : undefined;
      if (!agent || !agent.availableTools) continue;

      for (const toolId of agent.availableTools) {
        if (!registry.has(toolId)) {
          throw this.fail(
            mission,
            new OrchestratorError(
              'TOOL_UNAVAILABLE',
              `Tool indisponible pour l'agent "${agent.id}" : ${toolId}.`
            )
          );
        }
      }
    }
  }

  // ------------------------------------------------------------------ execution

  /**
   * Execute le plan dans l'ordre, en chainant les resultats.
   *
   * CHAINE DE RESULTATS (garantie d'ordre et de separation) :
   *   research -> analysis -> verification -> writer
   * Chaque agent recoit `results.slice()` : une copie ordonnee des etapes
   * deja terminees, ni plus ni moins, et jamais la liste vivante de la
   * mission. L'agent suivant ne peut ni observer les etapes posterieures,
   * ni muter l'historique des resultats.
   *
   * SEULE la surface de rendu (`agentId` + `content`) est dessinee dans son
   * prompt ; les metadonnees d'execution transportees par les memes objets
   * restent a disposition programmatique sans jamais entrer dans un prompt.
   *
   * Une etape qui echoue cloture immediatement la mission : aucune etape
   * suivante n'est executee et aucun resultat partiel n'est projete.
   */
  private async runSteps(mission: Mission, plan: MissionPlan): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (const step of plan.steps) {
      const agent = step.agentId ? this.agents.get(step.agentId) : undefined;

      if (!agent) {
        const message = step.agentId
          ? `Agent introuvable : ${step.agentId}.`
          : `Etape ${step.order + 1} sans agent associe.`;
        this.failStep(mission, step.id, message);
        throw this.fail(mission, new OrchestratorError('AGENT_INTROUVABLE', message));
      }

      if (agent.id === 'verification' && mission.status === 'RUNNING') {
        this.engine.transition(mission, 'VERIFYING');
      }

      this.engine.updateStep(mission, step.id, { status: 'RUNNING', startedAt: Date.now() });

      const agentStartedAt = Date.now();
      this.engine.observe({
        scope: 'agent',
        status: 'started',
        missionId: mission.id,
        stepId: step.id,
        agentId: agent.id,
        at: agentStartedAt,
      });

      let agentResult: AgentResult;
      try {
        agentResult = await agent.execute({
          missionId: mission.id,
          objective: mission.objective,
          context: mission.context,
          instruction: step.description ?? step.title,
          previousResults: results.slice(),
        });
      } catch (error) {
        // L'exception d'origine est conservee telle quelle (message, type,
        // marque de dependance) : seule une valeur non Error est normalisee,
        // afin que le contrat de rejet reste toujours une exception.
        const err =
          error instanceof Error
            ? error
            : new Error(describeError(error).errorMessage);
        this.engine.observe({
          scope: 'agent',
          status: 'failed',
          missionId: mission.id,
          stepId: step.id,
          agentId: agent.id,
          durationMs: Date.now() - agentStartedAt,
          ...describeError(err),
          at: Date.now(),
        });
        this.failStep(mission, step.id, err.message);
        // Le contexte connu ici est un echec d'etape : c'est le repli, la
        // nature reelle de l'erreur reste prioritaire.
        throw this.fail(mission, err, 'STEP');
      }

      this.engine.observe({
        scope: 'agent',
        status: 'completed',
        missionId: mission.id,
        stepId: step.id,
        agentId: agent.id,
        durationMs: Date.now() - agentStartedAt,
        model: agentResult.model,
        provider: agentResult.provider,
        at: Date.now(),
      });

      this.engine.updateStep(mission, step.id, {
        status: 'COMPLETED',
        output: agentResult.content,
        toolIds: agentResult.toolsUsed,
        finishedAt: Date.now(),
      });

      results.push(agentResult);
    }

    return results;
  }

  private failStep(mission: Mission, stepId: string, message: string): void {
    try {
      this.engine.updateStep(mission, stepId, {
        status: 'FAILED',
        error: publicErrorMessage(message),
        finishedAt: Date.now(),
      });
    } catch {
      // Etape deja terminale : l'echec de la mission reste prioritaire.
    }
  }

  /**
   * Marque la mission en echec via le MissionEngine puis renvoie l'erreur a
   * propager. GnoxeBrains n'a donc pas a re-marquer une mission deja
   * terminale.
   *
   * `hint` qualifie le contexte connu ici (etape en cours d'execution) ; il
   * ne sert que de repli lorsque la nature de l'exception est inconnue.
   */
  private fail(mission: Mission, error: Error, hint?: MissionErrorClass): Error {
    if (mission && !isTerminalStatus(mission.status)) {
      this.engine.fail(mission, error, hint);
    }
    return error;
  }

  // ------------------------------------------------------------------ resultat

  /**
   * PROJECTION finale : ce que l'appelant a le droit de recuperer.
   *
   * Conserve : contenu final (derniere etape), modele effectif, backend
   * reellement utilise, duree, gabarit du plan, et par etape uniquement des
   * metadonnees operationnelles (agentId, duree, tools, sources, warnings,
   * model, provider).
   *
   * Ne conserve JAMAIS : le contenu des etapes intermediaires, les prompts,
   * les messages, l'historique, aucun raisonnement interne, aucun evenement
   * d'observation. Les contenus intermediaires restent sur
   * `Mission.plan.steps[].output`, jamais recopies ici.
   *
   * USAGE : `aggregateUsage` parcourt une seule fois les resultats d'etapes.
   * Chaque etape n'a qu'une entree au plus, et les etapes sans usage ne sont
   * pas comptees comme des appels a zero token : sans aucun usage observe,
   * le champ `usage` reste absent (aucun zero fabrique).
   *
   * Aucune trace de raisonnement interne n'est exposee.
   */
  private buildResult(mission: Mission, plan: MissionPlan, results: AgentResult[]): MissionResult {
    const last = results.length > 0 ? results[results.length - 1] : undefined;
    const traced = [...results].reverse().find((r) => r.provider || r.model);
    const usage = aggregateUsage(results.map((r) => r.usage));

    return {
      content: last ? last.content : '',
      model: traced ? traced.model : undefined,
      provider: traced ? traced.provider : undefined,
      durationMs: Date.now() - mission.createdAt,
      data: {
        planSteps: plan.steps.length,
        steps: results.map((r) => ({
          agentId: r.agentId,
          durationMs: r.durationMs,
          toolsUsed: r.toolsUsed,
          sources: r.sources ?? [],
          warnings: r.warnings ?? [],
          model: r.model,
          provider: r.provider,
        })),
        warnings: results.flatMap((r) => r.warnings ?? []),
      },
      ...(usage ? { usage } : {}),
    };
  }
}
