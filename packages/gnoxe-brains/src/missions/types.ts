import { ChatMessage } from '@eyano/types';
import type { UsageTotals } from '../observability/usage';

/**
 * Types du moteur de mission de GnoxeBrains.
 *
 * Une Mission represente un objectif confie par l'utilisateur.
 * Flux conceptuel :
 *
 *   Mission -> Planning -> Steps -> Agents -> Tools -> Verification -> Result
 *
 * Ces types decrivent la STRUCTURE, jamais le comportement :
 * la planification et l'execution appartiennent a l'Orchestrator (etape 7).
 */

/**
 * Cycle de vie d'une mission (et, par extension documente, d'une etape).
 *
 * Responsabilite unique : LIFECYCLE D'EXECUTION. Ce n'est ni un contenu
 * epistemique (`AnalysisKind`), ni un etat de controle
 * (`VerificationStatus`), ni un evenement observe (`ObservationStatus`).
 *
 * Ordre canonique : PENDING -> PLANNING -> RUNNING -> VERIFYING -> COMPLETED.
 * FAILED et CANCELLED sont des etats terminaux accessibles depuis tout etat
 * non terminal. Aucun retrogradage n'est autorise (cf. `canTransition`).
 */
export type MissionStatus =
  | 'PENDING'
  | 'PLANNING'
  | 'RUNNING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/** Etapes terminales : aucune transition sortante. */
export const TERMINAL_MISSION_STATUSES: readonly MissionStatus[] = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];

/** Ordre canonique des etats non terminaux (les etats terminaux en sortent). */
export const MISSION_STATUS_ORDER: readonly MissionStatus[] = [
  'PENDING',
  'PLANNING',
  'RUNNING',
  'VERIFYING',
  'COMPLETED',
];

/**
 * Categorie homogene d'un echec de mission.
 *
 * Responsabilite unique : PERMETTRE A L'APPELANT DE DISTINGUER la nature
 * d'un echec sans avoir a connaitre les classes d'exception internes.
 * C'est une CLASSE PLATE (5 valeurs, aucune hierarchie ni imbrication),
 * pas une taxonomie d'erreurs : le code specifique reste `Mission.errorCode`.
 *
 * Distinctions a respecter :
 * - `MissionStatus` dit OU en est la mission, pas POURQUOI elle a echoue ;
 * - `ObservationStatus` est l'etat d'un evenement observe, pas d'un echec ;
 * - `AgentResult.warnings` liste des limites NON bloquantes ;
 * - les unions `*ErrorCode` restent les codes specifiques de chaque couche.
 */
export type MissionErrorClass =
  /** Refus avant toute execution (entree invalide). */
  | 'VALIDATION'
  /** Controle de la mission lui-meme (plan, cycle de vie). */
  | 'EXECUTION'
  /** Dependance externe indisponible : provider, tool. */
  | 'DEPENDENCY'
  /** Echec d'une etape ou d'un agent. */
  | 'STEP'
  /** Impossible a qualifier : erreur sans provenance connue. */
  | 'UNKNOWN';

export interface MissionStep {
  id: string;
  missionId: string;
  /** Position dans le plan (0 pour la premiere etape). */
  order: number;
  title: string;
  description?: string;
  /**
   * Etat de l'etape.
   *
   * Reutilise `MissionStatus` parce que c'est LE MEME CONCEPT (etat
   * d'execution), pas a cause d'un nom voisin. Seuls les etats applicables
   * a une etape sont utilises en pratique : PENDING, RUNNING, COMPLETED,
   * FAILED, CANCELLED, jamais PLANNING ni VERIFYING, qui decrivent le
   * cycle de la mission.
   */
  status: MissionStatus;
  /** Identifiant de l'agent charge de l'etape (defini a l'etape 5). */
  agentId?: string;
  /** Identifiants des tools mobilises par l'etape (definis a l'etape 5). */
  toolIds?: string[];
  input?: unknown;
  /**
   * Contenu publique de l'etape (`AgentResult.content`) des qu'elle est
   * COMPLETED.
   *
   * SEULE retention intermediaire sanctionnee : elle sert au diagnostic de
   * l'etape. Elle n'est jamais re-injectee dans un prompt, jamais copiee
   * dans `MissionResult`, jamais rendue dans un evenement d'observation.
   */
  output?: unknown;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface MissionPlan {
  missionId: string;
  objective: string;
  steps: MissionStep[];
  createdAt: number;
}

/**
 * Contexte d'une mission.
 *
 * Volontairement agrege et non couple au chat : `input` accepte n'importe
 * quelle entree. La memorisation fine (conversation / agent) arrive plus tard
 * via `memory/`.
 */
export interface MissionContext {
  userId?: string;
  conversationId?: string;
  /** Canal d'origine : `web`, `whatsapp`, ... */
  channel?: string;
  /** Identifiant logique du modele demande (`gnoxe-brains-*`). */
  model?: string;
  /** Entree brute fournie par l'appelant, au dela de l'objectif. */
  input?: unknown;
  /**
   * Historique conversationnel fourni par l'appelant.
   *
   * Type repris a `@eyano/types` : aucune deuxieme definition de message
   * n'est creee pour les missions.
   *
   * Statut : DONNEES UTILISATEUR NON FIABLES.
   * - borne a `maxContextMessages` messages a la creation de la mission
   *   (meme politique que `buildChatContext`, c.-a-d. les N derniers) ;
   * - rendu uniquement dans le message `user` des agents, sous une section
   *   explicitement etiquetee comme matiere ;
   * - jamais copie dans le message `systeme`, jamais dans un evenement
   *   d'observation.
   *
   * Les pieces jointes (`images`) ne sont jamais rendues par les agents.
   * Absent pour les missions sans conversation : le comportement historique
   * est conserve a l'identique.
   */
  messages?: ChatMessage[];
  /**
   * System instruction fournie par la couche applicative.
   *
   * UNIQUE porte d'entree d'une voix dans la mission : le cerveau n'en
   * porte aucune. Absente, seul `buildGnoxeBrainsInstruction()` forme le
   * message `systeme`.
   *
   * Statut : DONNEE APPLICATIVE. Construite en amont par l'appelant, deja
   * determinee au moment ou elle est transmise. A distinguer de `messages`
   * et `input` (donnees utilisateur non fiables, qui ne voyagent jamais
   * dans le message `systeme`) : ceci est la seule chaine externe que le
   * message `systeme` accepte, et elle n'est jamais derivee de ces donnees.
   */
  systemPrompt?: string;
  /**
   * Donnees de travail partagees entre les etapes.
   *
   * DECLAREES NON CONSOMMEES a ce stage : aucun prompt ne les rend, aucun
   * agent ne les lit. Ne pas les confondre avec `AgentResult.data`
   * (resultat d'une etape) ni avec `MissionResult.data` (projection
   * finale). Leur usage revient a la couche memoire/persistance.
   */
  data: Record<string, unknown>;
}

/**
 * Resultat final d'une mission : la PROJECTION, pas la mission.
 *
 * POLITIQUE DE RETENTION - conserve :
 * - `content` : le contenu final (derniere etape) ;
 * - `model` : identifiant logique effectivement utilise ;
 * - `provider` : backend reellement utilise (interne, jamais expose en API) ;
 * - `durationMs` : duree totale ;
 * - `data` : gabarit du plan, metadonnees operationnelles PAR ETAPE
 *   (agentId, duree, tools, sources, warnings, model, provider) et
 *   warnings agreges.
 *
 * NON conserve, deliberement :
 * - les contenus des etapes intermediaires (seule exception : reste sur
 *   `Mission.plan.steps[].output`, jamais recopie ici) ;
 * - prompts, messages, historique conversationnel ;
 * - chain-of-thought ni aucun raisonnement interne ;
 * - evenements d'observation (ils vivent dans l'observateur).
 *
 * Si une donnee est purement operationnelle, elle appartient a `data` ou a
 * l'observation, jamais a `content`.
 *
 * La telemetrie d'usage (`usage`) est une donnee d'appel, jamais un contenu :
 * elle ne porte ni prompt, ni objectif, ni message.
 */
export interface MissionResult {
  /** Contenu final produit par la mission. */
  content: string;
  /** Identifiant logique du modele utilise, si connu. */
  model?: string;
  /**
   * Nom du backend reellement utilise, si connu.
   *
   * INTERNE : l'identite du backend reste au sein du paquet (regle
   * d'identite Eyano). Toute projection applicative supprime ce champ
   * avant retour a l'appelant.
   */
  provider?: string;
  /** Duree totale de la mission en millisecondes. */
  durationMs: number;
  /** Donnees additionnelles : gabarit du plan, metadonnees par etape, warnings. */
  data?: Record<string, unknown>;
  /**
   * USAGE AGRUGE des appels modele de la mission.
   *
   * Present UNIQUEMENT si au moins un appel a rapporte un usage. Dans le
   * cas courant le champ est absent : aucun backend ne fournit encore de
   * decompte, et rien n'est invente pour remplir la case.
   *
   * Le tarif et le cout ne figurent jamais ici : le pricing reste une
   * responsabilite superieure applicative, jamais celle de cette couche.
   */
  usage?: UsageTotals;
}

export interface Mission {
  id: string;
  objective: string;
  status: MissionStatus;
  context: MissionContext;
  /** Construit pendant la phase de planification ; `null` tant que vide. */
  plan: MissionPlan | null;
  result: MissionResult | null;
  /**
   * Signature textuelle de l'echec (message court), renseignee sur `FAILED`.
   *
   * Reduite a la signature publique de l'erreur : jamais de stack trace,
   * jamais de prompt, jamais de raisonnement, jamais de contenu prive.
   */
  error?: string;
  /**
   * Code operationnel specifique de l'echec (`describeError`) : code metier
   * de la couche fautive s'il existe, sinon nom du type d'erreur.
   * Permet de distinguer une regle precise (`INVALID_OBJECTIVE`, `PLAN_VIDE`)
   * sans connaitre la classe d'exception.
   */
  errorCode?: string;
  /**
   * Categorie homogene de l'echec, pour distinguer validation, execution,
   * dependance, etape et inconnu sans connaitre les classes internes.
   * Renseignee en meme temps que `errorCode` quand la mission echoue.
   */
  errorClass?: MissionErrorClass;
  createdAt: number;
  updatedAt: number;
}
