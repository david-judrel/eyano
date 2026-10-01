import {
  Mission,
  MissionContext,
  MissionErrorClass,
  MissionResult,
  MissionStatus,
  MissionStep,
  MISSION_STATUS_ORDER,
  TERMINAL_MISSION_STATUSES,
} from './types';
import {
  ObservationEvent,
  ObservationStatus,
  describeError,
  isDependencyError,
  publicErrorMessage,
} from '../observability/events';
import { MissionObserver, noopObserver, safeObserve } from '../observability/observer';

export type MissionStepPatch = Partial<
  Pick<
    MissionStep,
    | 'title'
    | 'description'
    | 'status'
    | 'agentId'
    | 'toolIds'
    | 'input'
    | 'output'
    | 'error'
    | 'startedAt'
    | 'finishedAt'
  >
>;

export function isTerminalStatus(status: MissionStatus): boolean {
  return TERMINAL_MISSION_STATUSES.includes(status);
}

/**
 * Regle de transition : avancement strict dans l'ordre canonique.
 * Une etape terminale n'a plus de sortie ; une terminaison est toujours
 * autorisee depuis un etat non terminal (mission courte, annulation, erreur).
 */
export function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  if (from === to) return false;
  if (isTerminalStatus(from)) return false;
  if (isTerminalStatus(to)) return true;

  const fromIndex = MISSION_STATUS_ORDER.indexOf(from);
  const toIndex = MISSION_STATUS_ORDER.indexOf(to);
  return fromIndex >= 0 && toIndex >= 0 && toIndex > fromIndex;
}

export class MissionTransitionError extends Error {
  constructor(
    readonly from: MissionStatus,
    readonly to: MissionStatus
  ) {
    super(`Transition de mission invalide : ${from} -> ${to}`);
    this.name = 'MissionTransitionError';
  }
}

/**
 * Classe un echec en categorie homogene, pour l'appelant.
 *
 * Reutilise les contrats existants : le NOM et le CODE deja portes par les
 * exceptions (`GnoxeBrainsError`, `OrchestratorError`, `ToolRegistryError`,
 * `MissionTransitionError`) et la marque de dependance posee au niveau du
 * `ModelProvider`. Aucune classe d'erreur n'est creee pour autant.
 *
 * `hint` est un REPLI, jamais un override : une erreur qualifiee par sa
 * nature l'emporte sur le contexte dans lequel elle a ete interceptee.
 * Sans hint ni nature connue, l'echec est `UNKNOWN` plutot que mal classe.
 */
export function classifyMissionError(error: unknown, hint?: MissionErrorClass): MissionErrorClass {
  if (isDependencyError(error)) return 'DEPENDENCY';

  if (error instanceof Error) {
    const rawCode = (error as { code?: unknown }).code;
    const code = typeof rawCode === 'string' ? rawCode : undefined;

    switch (error.name) {
      case 'GnoxeBrainsError':
        return 'VALIDATION';
      case 'ToolRegistryError':
        return 'DEPENDENCY';
      case 'MissionTransitionError':
        return 'EXECUTION';
      case 'OrchestratorError':
        if (code === 'TOOL_UNAVAILABLE') return 'DEPENDENCY';
        if (code === 'INVALID_OBJECTIVE') return 'VALIDATION';
        if (code === 'AGENT_INTROUVABLE' || code === 'AGENT_INVALIDE') return 'STEP';
        return 'EXECUTION';
      default:
        break;
    }
  }

  return hint ?? 'UNKNOWN';
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Traduit un statut d'etape en cycle de vie observe. */
function toStepObservationStatus(status: MissionStatus): ObservationStatus {
  switch (status) {
    case 'RUNNING':
      return 'started';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    default:
      return 'changed';
  }
}

/**
 * Moteur de mission : creation, transitions d'etat et suivi des etapes.
 *
 * Perimetre volontairement limite a ce stade :
 * - PAS de planification automatique ;
 * - PAS de selection d'agents ou d'outils ;
 * - PAS d'execution.
 * Ces responsabilites reviennent a l'Orchestrator (etape 7).
 *
 * Le stockage est en memoire et non persiste : il sera remplace par
 * l'abstraction `memory/` quand le besoin sera etabli.
 *
 * Le moteur est aussi le point d'attachement de l'observation : il est la
 * source de verite du cycle de vie, donc l'endroit naturel pour rendre les
 * transitions de mission et d'etape observables. L'observation n'interagit
 * jamais avec la logique de transition.
 */
export class MissionEngine {
  private readonly missions = new Map<string, Mission>();
  private observer: MissionObserver = noopObserver;

  constructor(observer?: MissionObserver) {
    this.observer = observer ?? noopObserver;
  }

  /** Remplace l'observateur (injection depuis `GnoxeBrains`). */
  setObserver(observer?: MissionObserver): void {
    this.observer = observer ?? noopObserver;
  }

  getObserver(): MissionObserver {
    return this.observer;
  }

  /**
   * Publie un evenement operationnel.
   *
   * Une observation qui echoue n'interrompt jamais la mission : l'observabilite
   * est un service accessoire, pas un prerequis de l'execution.
   */
  observe(event: ObservationEvent): void {
    safeObserve(this.observer, event);
  }

  create(objective: string, context?: Partial<MissionContext>): Mission {
    const now = Date.now();
    const mission: Mission = {
      id: generateId('mission'),
      objective,
      status: 'PENDING',
      context: {
        userId: context?.userId,
        conversationId: context?.conversationId,
        channel: context?.channel,
        model: context?.model,
        input: context?.input,
    messages: context?.messages,
    systemPrompt: context?.systemPrompt,
    data: context?.data ?? {},
      },
      plan: null,
      result: null,
      createdAt: now,
      updatedAt: now,
    };

    this.missions.set(mission.id, mission);
    this.observe({
      scope: 'mission',
      status: 'started',
      missionId: mission.id,
      phase: mission.status,
      at: Date.now(),
    });
    return mission;
  }

  get(id: string): Mission | undefined {
    return this.missions.get(id);
  }

  list(filter?: { status?: MissionStatus; userId?: string }): Mission[] {
    const all = Array.from(this.missions.values());
    if (!filter) return all;

    return all.filter(
      (m) =>
        (filter.status === undefined || m.status === filter.status) &&
        (filter.userId === undefined || m.context.userId === filter.userId)
    );
  }

  /** Applique une transition en place et renvoie la meme mission. */
  transition(mission: Mission, next: MissionStatus): Mission {
    if (!canTransition(mission.status, next)) {
      throw new MissionTransitionError(mission.status, next);
    }
    mission.status = next;
    mission.updatedAt = Date.now();
    this.observe({
      scope: 'mission',
      status: 'changed',
      missionId: mission.id,
      phase: next,
      at: Date.now(),
    });
    return mission;
  }

  /** Cree une etape dans le plan. Le plan est cree paresseusement. */
  addStep(
    mission: Mission,
    step: { title: string; description?: string; agentId?: string; toolIds?: string[] }
  ): MissionStep {
    this.assertNotTerminal(mission);

    if (!mission.plan) {
      mission.plan = {
        missionId: mission.id,
        objective: mission.objective,
        steps: [],
        createdAt: Date.now(),
      };
    }

    const created: MissionStep = {
      id: generateId('step'),
      missionId: mission.id,
      order: mission.plan.steps.length,
      title: step.title,
      description: step.description,
      agentId: step.agentId,
      toolIds: step.toolIds,
      status: 'PENDING',
    };

    mission.plan.steps.push(created);
    mission.updatedAt = Date.now();
    return created;
  }

  updateStep(mission: Mission, stepId: string, patch: MissionStepPatch): MissionStep {
    const step = mission.plan?.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Etape introuvable : ${stepId}`);
    }
    const previousStatus = step.status;
    if (patch.status && patch.status !== previousStatus) {
      if (!canTransition(previousStatus, patch.status)) {
        throw new MissionTransitionError(previousStatus, patch.status);
      }
    }

    Object.assign(step, patch);
    mission.updatedAt = Date.now();

    if (patch.status && patch.status !== previousStatus) {
      const observation: ObservationEvent = {
        scope: 'step',
        status: toStepObservationStatus(step.status),
        missionId: mission.id,
        stepId: step.id,
        agentId: step.agentId,
        phase: step.status,
        at: Date.now(),
      };
      if (typeof step.error === 'string' && step.error) {
        observation.errorMessage = step.error;
      }
      this.observe(observation);
    }

    return step;
  }

  /** Termine la mission. `durationMs` est calcule si absent. */
  complete(
    mission: Mission,
    result: Partial<MissionResult> & { content: string }
  ): Mission {
    this.assertNotTerminal(mission);

    const finalized: MissionResult = {
      content: result.content,
      model: result.model ?? mission.context.model,
      provider: result.provider,
      durationMs: result.durationMs ?? Date.now() - mission.createdAt,
      data: result.data,
      // Usage : repris tel quel s'il existe. Aucun zero n'est substitue,
      // et un resultat sans usage garde exactement le meme ensemble de cles.
      ...(result.usage ? { usage: result.usage } : {}),
    };

    mission.status = 'COMPLETED';
    mission.result = finalized;
    mission.updatedAt = Date.now();
    this.observe({
      scope: 'mission',
      status: 'completed',
      missionId: mission.id,
      phase: mission.status,
      durationMs: finalized.durationMs,
      model: finalized.model,
      provider: finalized.provider,
      at: Date.now(),
    });
    return mission;
  }

  /**
   * Termine la mission en echec avec une signature publique exploitable.
   *
   * Point d'unique de cloture en echec : `error` accepte une exception ou un
   * message brut, `errorCode` et `errorClass` sont derives de l'exception
   * elle-meme. La mission ne peut donc plus rester bloquee dans un etat non
   * terminal apres un appel a `fail()`.
   *
   * `hint` (optionnel) qualifie un echec que la nature de l'exception ne
   * permet pas de classifier (cf. `classifyMissionError`).
   */
  fail(mission: Mission, error: unknown, hint?: MissionErrorClass): Mission {
    this.assertNotTerminal(mission);

    const { errorCode, errorMessage } = describeError(error);
    const publicMessage = publicErrorMessage(errorMessage, errorCode);
    const errorClass = classifyMissionError(error, hint);

    mission.status = 'FAILED';
    mission.error = publicMessage;
    mission.errorCode = errorCode;
    mission.errorClass = errorClass;
    mission.updatedAt = Date.now();

    this.observe({
      scope: 'mission',
      status: 'failed',
      missionId: mission.id,
      phase: mission.status,
      durationMs: Date.now() - mission.createdAt,
      errorCode,
      errorMessage: publicMessage,
      at: Date.now(),
    });
    return mission;
  }

  cancel(mission: Mission): Mission {
    this.assertNotTerminal(mission);
    mission.status = 'CANCELLED';
    mission.updatedAt = Date.now();
    this.observe({
      scope: 'mission',
      status: 'cancelled',
      missionId: mission.id,
      phase: mission.status,
      durationMs: Date.now() - mission.createdAt,
      at: Date.now(),
    });
    return mission;
  }

  remove(id: string): boolean {
    return this.missions.delete(id);
  }

  clear(): void {
    this.missions.clear();
  }

  private assertNotTerminal(mission: Mission): void {
    if (isTerminalStatus(mission.status)) {
      throw new Error(
        `Mission deja terminee (${mission.status}) : operation impossible.`
      );
    }
  }
}
