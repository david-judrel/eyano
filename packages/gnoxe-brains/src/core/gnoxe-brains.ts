import { ChatMessage } from '@eyano/types';
import { Mission, MissionContext, MissionErrorClass, MissionResult } from '../missions/types';
import {
  MissionEngine,
  classifyMissionError,
  isTerminalStatus,
} from '../missions/mission-engine';
import { MissionExecutor } from '../missions/mission-executor';
import { ToolRegistry } from '../tools/registry';
import { Agent } from '../agents/agent';
import { ModelProvider, ModelChunk, ImageGenerationError } from '../providers/model-provider';
import { PlanBuilder } from '../orchestrator/planner';
import { MissionObserver } from '../observability/observer';
import { GnoxeBrainsConfig, getGnoxeBrainsConfig } from './config';
import { GNOXE_BRAINS_PERSONALITY, buildGnoxeBrainsInstruction } from './personality';
import { createDefaultExecutor, resolveDefaultModelProvider } from './defaults';
import { modelResolver } from './model-resolver';
import { providerCapabilityResolver } from './provider-capability-resolver';
import { executionPolicy } from './execution-policy';
import { executionReliability } from './execution-reliability';

export interface GnoxeBrainsRunInput {
  /** Objectif confie au systeme. */
  objective: string;
  /**
   * Contexte completement ou partiellement fourni par l'appelant.
   *
   * `context.messages` transporte l'historique conversationnel (type
   * `ChatMessage` de `@eyano/types`). Il est borne a
   * `maxContextMessages` messages puis rendu dans le message `user`
   * des agents comme matiere utilisateur.
   */
  context?: Partial<MissionContext>;
}

export interface GnoxeBrainsRunOutput {
  mission: Mission;
  result: MissionResult;
}

/**
 * Entree d'une reponse courte : un tour de conversation, sans mission.
 *
 * `messages` est deja prepare par la facade applicative (system instruction,
 * historique, contexte de canal). GnoxeBrains ne reecrit jamais ce prompt.
 */
export interface GnoxeAnswerInput {
  /** Historique complet, system instruction comprise. */
  messages: ChatMessage[];
  /** Identifiant logique du modele demande (`gnoxe-brains-*`). */
  model?: string;
  /**
   * Temperature demandee. Jugee par la police d execution (`execution-policy`)
   * puis transmise telle quelle : aucun defaut n est injecte ici.
   */
  temperature?: number;
  /**
   * Budget de sortie demande. Juge d abord par la police d execution, puis
   * confronte a la capacite du modele (etape 20) : deux regles distinctes.
   */
  maxTokens?: number;
}

/** Resultat d'une reponse courte. */
export interface GnoxeAnswerResult {
  content: string;
  /** Identifiant logique effectivement utilise. */
  model: string;
  /** Identifiant du backend reellement utilise (interne, jamais expose en API). */
  provider: string;
}

/** Evenement d'une reponse courte en streaming. */
export type GnoxeAnswerChunk =
  | { type: 'text'; content: string }
  | { type: 'done'; content: string; model: string; provider: string };

/**
 * Codes d'erreur de VALIDATION d'entree a la facade.
 *
 * Responsabilite unique : refuser un appel avant toute creation de mission.
 * Distinct d'`OrchestratorErrorCode` (echecs d'execution) et de
 * `ToolRegistryErrorCode` (defauts de registre).
 *
 * Une meme regle produit le meme code quelle que soit la couche : la regle
 * "objectif non vide" vaut `INVALID_OBJECTIVE` ici comme dans
 * l'Orchestrator ; la classe d'exception porte la distinction de couche.
 */
export type GnoxeBrainsErrorCode = 'INVALID_OBJECTIVE';

/** Kepler Image : longueur maximale d'un prompt. */
export const MAX_IMAGE_PROMPT_LENGTH = 2000;

export interface GnoxeImageInput {
  prompt: string;
  /** Identifiant logique `kepler-image-*` ; absent = modele par defaut. */
  model?: string;
}

/** Image generee : base64, type MIME, identifiant logique. Rien d'autre. */
export interface GnoxeImageResult {
  data: string;
  mimeType: string;
  model: string;
}

export class GnoxeBrainsError extends Error {
  constructor(
    readonly code: GnoxeBrainsErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'GnoxeBrainsError';
  }
}

/**
 * Rend la categorie d'echec visible directement sur l'exception rejetee
 * par `run()`, sans modifier l'identite de celle-ci.
 *
 * Ajout strict : nom, message, code et type d'origine sont conserves. La
 * propriete n'est pas enumerable afin de ne pas apparaitre dans une
 * serialisation. Une valeur deja presente n'est jamais ecrasee.
 */
function attachErrorClass(error: unknown, fallback?: MissionErrorClass): void {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) return;

  try {
    const carrier = error as Record<string, unknown>;
    if (carrier.errorClass === undefined) {
      Object.defineProperty(carrier, 'errorClass', {
        value: fallback ?? classifyMissionError(error),
        enumerable: false,
        configurable: true,
        writable: true,
      });
    }
  } catch {
    // Objet fige : la categorie reste lisible sur `Mission.errorClass`.
  }
}

export interface GnoxeBrainsOptions {
  engine?: MissionEngine;
  /** Executeur surcharge ; par defaut un `Orchestrator` est assemble. */
  executor?: MissionExecutor;
  /** Surcharge de configuration pour cette instance uniquement. */
  config?: Partial<GnoxeBrainsConfig>;
  /** Agents injectes (tests, agents metier) ; le pipeline standard sinon. */
  agents?: Agent[];
  /** Registre de tools utilise pour la validation du plan. */
  toolRegistry?: ToolRegistry;
  /** Planificateur surcharge ; le planificateur deterministe sinon. */
  planBuilder?: PlanBuilder;
  /** ModelProvider ; le provider actif est resolu via la racine de composition. */
  modelProvider?: ModelProvider;
  /**
   * Observateur operationnel. Par defaut : aucun (`noopObserver`), c'est a
   * dire exactement le comportement d'avant observabilite.
   */
  observer?: MissionObserver;
}

/**
 * Facade principale de la couche d'intelligence d'EYANO.
 *
 * Chainage cible :
 *   GnoxeBrains -> Mission Engine -> Orchestrator -> Agents -> Tools -> ModelProvider
 *
 * Cette facade ne connait AUCUN provider concret : elle cree la mission,
 * la confie a son executor puis enregistre l'issue. Le plan, le choix des
 * agents et l'execution appartiennent a l'Orchestrator.
 */
export class GnoxeBrains {
  readonly personality = GNOXE_BRAINS_PERSONALITY;

  private readonly engine: MissionEngine;
  private readonly executor: MissionExecutor;
  private readonly config: GnoxeBrainsConfig;
  private readonly injectedProvider?: ModelProvider;
  private readonly observer: MissionObserver;

  constructor(options: GnoxeBrainsOptions = {}) {
    this.engine = options.engine ?? new MissionEngine();
    if (options.observer) {
      this.engine.setObserver(options.observer);
    }
    this.observer = this.engine.getObserver();
    this.injectedProvider = options.modelProvider;
    this.executor =
      options.executor ??
      createDefaultExecutor({
        engine: this.engine,
        agents: options.agents,
        toolRegistry: options.toolRegistry,
        planBuilder: options.planBuilder,
        modelProvider: options.modelProvider,
        observer: this.observer,
      });
    this.config = { ...getGnoxeBrainsConfig(), ...options.config };
  }

  getConfig(): Readonly<GnoxeBrainsConfig> {
    return this.config;
  }

  /** Observateur operationnel effectivement branche sur cette instance. */
  getObserver(): MissionObserver {
    return this.observer;
  }

  /** Consigne textuelle issue de la personnalite de GnoxeBrains. */
  getPersonalityInstruction(): string {
    return buildGnoxeBrainsInstruction();
  }

  /**
   * Resolution du modele d'un appel court, par la couche `ModelResolver`.
   *
   * Trois cas, tranches avant tout appel modele :
   * - ni modele ni capacite demandes : le defaut de configuration est rendu
   *   tel quel, comportement strictement preserve ;
   * - capacite demandee sans modele : la preference declaree par la
   *   configuration reste la reference. Si elle couvre l'exigence elle est
   *   utilisee telle quelle ; sinon la resolution est REFUSEE, jamais
   *   substituee par un autre modele (aucun repli automatique) ;
   * - modele demande : presence au catalogue, disponibilite puis capacite,
   *   chaque incompatibilite rejetee par une `ModelResolutionError`
   *   explicite plutot que de laisser le refus survenir dans le backend.
   */
  private resolveModel(model?: string, minMaxTokens?: number): string {
    const requested = model?.trim() || this.config.defaultModel;

    return modelResolver.resolve({ model: requested, minMaxTokens });
  }

  private resolveProvider(): ModelProvider {
    return this.injectedProvider ?? resolveDefaultModelProvider();
  }

  /**
   * Applique la politique de limitation de l'historique, a la source.
   *
   * Source de verite unique : `maxContextMessages`, le meme champ que la
   * politique de `buildChatContext` (20, les N derniers messages). Une
   * mission ne peut donc pas porter un historique arbitrairement grand.
   *
   * Une valeur nulle ou negative conserve aucun message.
   */
  private limitMessages(context?: Partial<MissionContext>): Partial<MissionContext> {
    if (!context) return {};
    if (!Array.isArray(context.messages)) return context;

    const max = Math.max(0, this.config.maxContextMessages);
    const messages = max > 0 ? context.messages.slice(-max) : [];
    return { ...context, messages };
  }

  // ---------------------------------------------------------------- reponse courte

  /**
   * Kepler Image : generation d'une image a partir d'un prompt.
   *
   * Meme principe que `answer()` : les flows passent par la facade, jamais
   * par le provider directement. Aucun pipeline multi-agents, un seul appel.
   * La capacite est OPTIONNELLE : un provider qui ne la declare pas donne
   * `UNAVAILABLE`, jamais un repli silencieux. Le nom du backend ne sort pas
   * d'ici : le resultat ne porte que l'image et l'identifiant logique.
   */
  async generateImage(input: GnoxeImageInput): Promise<GnoxeImageResult> {
    const prompt = typeof input?.prompt === 'string' ? input.prompt.trim() : '';
    if (!prompt) {
      throw new ImageGenerationError('INVALID_PROMPT', 'Un prompt non vide est requis.');
    }
    if (prompt.length > MAX_IMAGE_PROMPT_LENGTH) {
      throw new ImageGenerationError(
        'INVALID_PROMPT',
        `Le prompt depasse ${MAX_IMAGE_PROMPT_LENGTH} caracteres.`
      );
    }

    const provider = this.resolveProvider();
    if (!provider.capabilities().imageGeneration || typeof provider.generateImage !== 'function') {
      throw new ImageGenerationError('UNAVAILABLE', "La generation d'images n'est pas disponible.");
    }

    const result = await provider.generateImage({ prompt, model: input.model });
    return { data: result.data, mimeType: result.mimeType, model: result.model };
  }

  /**
   * Reponse courte (un tour de conversation) : un seul appel modele.
   *
   * Court-circuit documente : un tour de chat doit rester synchrone et
   * cout peu. Il ne declenche PAS le pipeline multi-agents, disponible via
   * `run()`. Les flows applicatifs passent exclusivement par ici (etape 8),
   * afin qu'il n'existe plus d'architecture parallele d'appel de modele.
   */
  async answer(input: GnoxeAnswerInput): Promise<GnoxeAnswerResult> {
    // POLICE D EXECUTION : le seul endroit ou les parametres sont juges.
    // `answer()` ne declare qu un mode : les valeurs sont transmises telles
    // quelles, jamais corrigees en chemin.
    const execution = executionPolicy.validate({
      streaming: false,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });

    const provider = this.resolveProvider();
    const model = this.resolveModel(input.model, input.maxTokens);

    // Derniere porte avant execution : ce que la police declare est exactement
    // ce qui est exige au provider. `generate()` ne demande aucun drapeau.
    providerCapabilityResolver.resolve(provider.capabilities(), {
      model,
      requires: {
        streaming: execution.streaming,
        structuredOutput: execution.structuredOutput,
      },
    });

    // EXECUTION : la couche de reliability qualifie la panne provider sans
    // jamais la remplacer. Une exception survenue ici signifie que les
    // trois validations precedentes ont reussi et que l appel a eu lieu.
    const response = await executionReliability.call(() =>
      provider.generate({
        messages: input.messages,
        model,
        ...execution.providerParameters,
      })
    );

    return {
      content: response.content,
      model: response.model || model,
      provider: response.provider || provider.name,
    };
  }

  /**
   * Meme contrat qu'`answer()` mais en streaming.
   *
   * Le streaming est conserve au niveau du `ModelProvider` : la facade
   * applicative relaye chaque fragment tel quel. Aucun chainage de pensee
   * n'est produit ni expose, seulement le texte de la reponse.
   */
  async *answerStream(input: GnoxeAnswerInput): AsyncGenerator<GnoxeAnswerChunk> {
    // MEME police que `answer()` : une seule regle d execution, deux modes
    // declarables. Seul `streaming` differe, et c est ce qui declenche le
    // drapeau de capacite exig ci-dessous.
    const execution = executionPolicy.validate({
      streaming: true,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });

    const provider = this.resolveProvider();
    const model = this.resolveModel(input.model, input.maxTokens);

    // Derniere porte avant execution : le mode streame est exige ici, parce
    // que c est ce que cette methode use, pas parce qu un autre l a ecrit.
    providerCapabilityResolver.resolve(provider.capabilities(), {
      model,
      requires: {
        streaming: execution.streaming,
        structuredOutput: execution.structuredOutput,
      },
    });

    let fullResponse = '';
    let reportedModel = '';
    let fragmentsDelivered = 0;

    // OUVERTURE : un echec ici n a encore rien rendu a l appelant.
    let iterator: AsyncIterator<ModelChunk>;

    try {
      const stream = provider.stream({
        messages: input.messages,
        model,
        ...execution.providerParameters,
      });
      iterator = stream[Symbol.asyncIterator]();
    } catch (error) {
      throw executionReliability.streamFailure(error, 0);
    }

    try {
      // BOUCLE MANUELLE, volontairement : seul le rejet de `next()` est
      // qualifie en echec provider. Le `yield` reste hors de tout `try`,
      // donc une exception lancee par le CONSOMMATEUR ne peut jamais etre
      // requalifiee en panne de provider, et la fermeture du flux reste
      // garantie par le `finally`.
      for (;;) {
        let step: IteratorResult<ModelChunk>;

        try {
          step = await iterator.next();
        } catch (error) {
          throw executionReliability.streamFailure(error, fragmentsDelivered);
        }

        if (step.done === true) break;

        const chunk = step.value;
        if (chunk.type === 'text') {
          fullResponse += chunk.content;
          fragmentsDelivered += 1;
          yield { type: 'text', content: chunk.content };
        } else if (chunk.type === 'done') {
          if (chunk.content) fullResponse = chunk.content;
          if (chunk.model) reportedModel = chunk.model;
        }
      }
    } finally {
      // La fermeture du flux provider n a pas le droit de se substituer a
      // l echec en cours ni de le doubler : elle est executee en silence.
      try {
        await iterator.return?.();
      } catch {
        // Fermeture echouee : l exception d origine prime toujours.
      }
    }

    yield { type: 'done', content: fullResponse, model: reportedModel || model, provider: provider.name };
  }

  /**
   * Cree une mission sans l'executer (utile pour inspection ou test).
   *
   * L'historique `context.messages` est borne ici a `maxContextMessages`
   * avant d'etre stocke : le transport de l'historique est controle par la
   * facade, pas par les agents.
   */
  createMission(objective: string, context?: Partial<MissionContext>): Mission {
    const trimmed = objective?.trim();
    if (!trimmed) {
      throw new GnoxeBrainsError('INVALID_OBJECTIVE', 'Un objectif non vide est requis.');
    }

    return this.engine.create(trimmed, {
      model: this.config.defaultModel,
      ...this.limitMessages(context),
    });
  }

  getMission(id: string): Mission | undefined {
    return this.engine.get(id);
  }

  listMissions(filter?: { status?: Mission['status']; userId?: string }): Mission[] {
    return this.engine.list(filter);
  }

  /**
   * Execute un objectif de bout en bout.
   *
   * L'Orchestrator pilote le cycle de vie complet (planification, execution,
   * cloture). Cette facade n'intervient que pour finaliser un executor qui
   * aurait rendu un resultat sans cloturer la mission, et pour marquer en
   * echec une mission que l'executor a laissee non terminale. Une mission deja
   * terminale n'est jamais re-marquee.
   *
   * GARANTIE D'EXECUTION : quel que soit le point ou une exception traverse
   * `MissionExecutor.execute()` (agent, tool, provider, plan, executor lui-
   * meme), la mission est cloturee en `FAILED` avec `error`, `errorCode` et
   * `errorClass` exploitables, jamais laissee dans `RUNNING`.
   * La signature publique de l'echec est bornee : pas de stack trace, pas de
   * prompt, pas de raisonnement dans `Mission.error` ni dans les evenements.
   *
   * HORS PERIMETRE A CE STAGE (constats, pas d'implementation) :
   * - `config.missionTimeoutMs` n'est PAS applique : 0 veut dire illimite,
   *   et aucune minuterie n'existe. Le point d'insertion minimal serait ici,
   *   autour de l'appel a `executor.execute()`.
   * - aucun `AbortSignal` : le point d'insertion minimal serait un champ
   *   optionnel sur `GnoxeBrainsRunInput`, propage jusqu'aux appels modele.
   *   Aucun contrat existant n'est modifie en attendant.
   */
  async run(input: GnoxeBrainsRunInput): Promise<GnoxeBrainsRunOutput> {
    let mission: Mission | undefined;

    try {
      mission = this.createMission(input.objective, input.context);

      const result = await this.executor.execute(mission);

      if (isTerminalStatus(mission.status)) {
        return { mission, result: mission.result ?? result };
      }

      const finalized = this.engine.complete(mission, result);
      return { mission: finalized, result: finalized.result as MissionResult };
    } catch (error) {
      // Une exception hors de tout controle ne doit jamais laisser la
      // mission dans un etat intermediaire : elle est cloturee ici, puis
      // repropagee a l'identique (jamais masquee, jamais reformatee).
      if (mission && !isTerminalStatus(mission.status)) {
        this.engine.fail(mission, error);
      }
      attachErrorClass(error, mission?.errorClass);
      throw error;
    }
  }
}
