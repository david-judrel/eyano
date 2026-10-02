import { Injectable } from '@nestjs/common';
import { GnoxeBrains, MemoryObserver } from '@eyano/gnoxe-brains';
import { buildEyanoContext } from '@eyano/eyano-identity';
import type {
  MissionContext,
  MissionObserver,
  MissionStatus,
  ObservationEvent,
} from '@eyano/gnoxe-brains';
import type { ChatMessage } from '@eyano/types';

export interface RunMissionInput {
  objective: string;
  model?: string;
  /**
   * Historique conversationnel a transmettre a la mission.
   *
   * De la matiere utilisateur : bornee a `maxContextMessages` messages par
   * `GnoxeBrains.createMission()` puis rendue dans le message `user` des
   * agents. Jamais exposee dans la trace retournee a l'appelant.
   */
  messages?: ChatMessage[];
}

export interface MissionStepSummary {
  order: number;
  title: string;
  status: string;
  agentId?: string;
  toolIds?: string[];
}

export interface MissionResultSummary {
  content: string;
  model?: string;
  durationMs: number;
  warnings: string[];
}

/**
 * Trace complete d'une execution : resultat metier plus trace operationnelle.
 *
 * `provider` n'est volontairement absent : l'identite du backend reel reste
 * interne au package (regle d'identite Eyano).
 */
export interface MissionTrace {
  missionId: string;
  status: MissionStatus;
  durationMs: number;
  plan: MissionStepSummary[];
  agents: string[];
  toolsUsed: string[];
  result: MissionResultSummary;
  events: ObservationEvent[];
}

/**
 * Echec d'une mission : conserve l'identifiant et les evenements observes
 * afin que l'appelant puisse tracer ce qui a tourne avant l'erreur.
 */
export class MissionExecutionError extends Error {
  constructor(
    readonly missionId: string,
    readonly events: ObservationEvent[],
    message: string
  ) {
    super(message);
    this.name = 'MissionExecutionError';
  }
}

/** Donnees d'etape produites par l'Orchestrator dans `MissionResult.data`. */
interface OrchestratorStepData {
  agentId?: string;
  durationMs?: number;
  toolsUsed?: string[];
  warnings?: string[];
}

interface MissionResultData {
  steps?: OrchestratorStepData[];
  warnings?: unknown[];
}

/**
 * Projection applicative d'un evenement.
 *
 * Le champ `provider` porte le nom technique du backend : il reste interne.
 * Tous les autres champs du contrat sont retournes a l'identique.
 */
function toPublicEvent(event: ObservationEvent): ObservationEvent {
  const copy: ObservationEvent = { ...event };
  delete copy.provider;
  return copy;
}

/**
 * Premier cas d'usage reel de `GnoxeBrains.run()`.
 *
 * Le service ne construit ni plan, ni agents, ni tools, ni provider : il
 * instancie une facade `GnoxeBrains` par execution, lui branche un
 * `MissionObserver` reel et laisse l'Orchestrator piloter le pipeline
 * `recherche -> analyse -> verification -> redaction`.
 *
 * Une instance par execution (et non le singleton partage par les flows de
 * chat) garantit que chaque mission possede son propre observateur et son
 * propre etat de moteur : aucune mission n'est conservee entre deux requetes.
 */
@Injectable()
export class MissionsService {
  private observerFactory: () => MissionObserver | undefined = () => new MemoryObserver(500);

  /**
   * Remplace la fabrique d'observateur (tests, injection externe).
   *
   * Renvoyer `undefined` execute la mission sans observation : c'est
   * exactement le comportement historique (`noopObserver`).
   */
  setObserverFactory(factory: () => MissionObserver | undefined): void {
    this.observerFactory = factory;
  }

  async run(input: RunMissionInput, userId?: string): Promise<MissionTrace> {
    const observer = this.observerFactory();
    const brains = new GnoxeBrains({ observer });

    const context: Partial<MissionContext> = {
      userId,
      channel: 'admin',
      data: {},
    };
    if (input.model) context.model = input.model;
    if (input.messages && input.messages.length > 0) {
      context.messages = input.messages;
    }

    try {
      const { mission, result } = await brains.run({
        objective: input.objective,
        context: { ...context, systemPrompt: buildEyanoContext({ channel: 'admin' }) },
      });
      const data = (result.data ?? {}) as MissionResultData;
      const steps = Array.isArray(data.steps) ? data.steps : [];
      const planSteps = mission.plan?.steps ?? [];
      const warnings = (Array.isArray(data.warnings) ? data.warnings : []).filter(
        (entry): entry is string => typeof entry === 'string'
      );

      return {
        missionId: mission.id,
        status: mission.status,
        durationMs: result.durationMs,
        plan: planSteps.map((step) => ({
          order: step.order,
          title: step.title,
          status: step.status,
          agentId: step.agentId,
          toolIds: step.toolIds,
        })),
        agents: planSteps
          .map((step) => step.agentId)
          .filter((agentId): agentId is string => Boolean(agentId)),
        toolsUsed: [...new Set(steps.flatMap((step) => step.toolsUsed ?? []))],
        result: {
          content: result.content,
          model: result.model,
          durationMs: result.durationMs,
          warnings,
        },
        events: this.readEvents(observer),
      };
    } catch (error) {
      const events = this.readEvents(observer);

      // Aucun evenement : la mission n'a jamais ete creee (entree invalide).
      // On propage l'erreur d'origine sans la reformater.
      if (events.length === 0) throw error;

      const missionId = events.find((event) => event.scope === 'mission')?.missionId ?? '';
      const message = error instanceof Error ? error.message : 'Mission echouee.';
      throw new MissionExecutionError(missionId, events, message);
    }
  }

  private readEvents(observer?: MissionObserver): ObservationEvent[] {
    if (observer instanceof MemoryObserver) {
      return observer.events.map(toPublicEvent);
    }
    return [];
  }
}
