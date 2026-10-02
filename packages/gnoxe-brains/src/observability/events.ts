/**
 * Evenements operationnels de GnoxeBrains.
 *
 * PERIMETRE : operationnel uniquement.
 *
 * Un evenement decrit QUI a tourne (mission, etape, agent, tool), QUEL EST
 * SON ETAT et COMBIEN CA A DURE. C'est tout.
 *
 * Interdit dans ces structures, par conception :
 * - chain-of-thought ou raisonnement interne detaille ;
 * - contenu des prompts ou des messages de conversation ;
 * - contenu prive des reponses d'agents (`content`) ;
 * - memoire avancee, base vectorielle, telemetrie externe.
 *
 * `OBSERVATION_EVENT_KEYS` fait foi : un evenement ne peut contenir que
 * ces champs. Toute extension doit passer par ici et etre justifiee.
 */

export type ObservationScope = 'mission' | 'step' | 'agent' | 'tool';

/**
 * Cycle de vie observe d'un evenement.
 *
 * Responsabilite unique : CE QUI SE PASSE, pas l'etat de l'entite.
 * `phase` porte l'etat metier (`MissionStatus`) observe apres l'evenement :
 * les deux vocabulaires sont volontairement distincts et jamais melanges.
 *
 * `changed` couvre les transitions d'etat intermediaires (PLANNING,
 * RUNNING, VERIFYING) qui ne sont ni un debut ni une fin.
 * `cancelled` couvre l'annulation explicite d'une mission.
 *
 * Volontairement en minuscules : ces valeurs n'appartiennent a aucune
 * autre taxonomie du paquet.
 */
export type ObservationStatus = 'started' | 'completed' | 'failed' | 'cancelled' | 'changed';

export interface ObservationEvent {
  /** Portee operationnelle de l'evenement. */
  scope: ObservationScope;
  /** Cycle de vie observe. */
  status: ObservationStatus;
  /** Mission concernee. */
  missionId: string;
  /** Etape concernee, quand l'evenement en concerne une. */
  stepId?: string;
  /** Agent concerne. */
  agentId?: string;
  /** Tool concerne (scope `tool`). */
  toolId?: string;
  /**
   * Etat metier observe apres l'evenement (mission ou etape).
   *
   * Chaine volontairement non typifiee : l'observation ne doit importer
   * aucun domaine (regle verifiee par `architecture.test.js`). Les valeurs
   * effectivement emises sont celles de `MissionStatus`.
   */
  phase?: string;
  /** Duree ecoulee en ms, renseignee sur un evenement terminal. */
  durationMs?: number;
  /** Code d'erreur operationnel (code metier, sinon nom du type d'erreur). */
  errorCode?: string;
  /** Message d'erreur court. Jamais de prompt, jamais de reponse. */
  errorMessage?: string;
  /** Identifiant logique du modele utilise, quand il est connu. */
  model?: string;
  /** Nom du backend utilise, quand il est connu. */
  provider?: string;
  /** Horodatage epoch ms de l'evenement. */
  at: number;
}

/** Liste fermee des champs autorises dans un evenement. */
export const OBSERVATION_EVENT_KEYS: readonly (keyof ObservationEvent)[] = Object.freeze([
  'scope',
  'status',
  'missionId',
  'stepId',
  'agentId',
  'toolId',
  'phase',
  'durationMs',
  'errorCode',
  'errorMessage',
  'model',
  'provider',
  'at',
]);

/** Champs explicitement interdits : garde-fou contre toute fuite de raisonnement. */
export const FORBIDDEN_OBSERVATION_KEYS: readonly string[] = Object.freeze([
  'content',
  'prompt',
  'messages',
  'objective',
  'reasoning',
  'rationale',
  'thoughts',
  'chainOfThought',
  'input',
  'output',
  'data',
]);

/** Longueur maximale conservee d'un message d'erreur public. */
const MAX_ERROR_MESSAGE_LENGTH = 500;

/**
 * Ramene une erreur a sa SIGNATURE PUBLIQUE : une seule ligne, bornee.
 *
 * Jamais de stack trace, jamais de prompt, jamais de raisonnement, jamais
 * de corps HTTP multiligne : seule la cause telle qu'elle est formulee par
 * la couche fautive est conservee, afin que `Mission.error`,
 * `MissionStep.error` et `ObservationEvent.errorMessage` restent lisibles
 * et exploitables.
 */
export function publicErrorMessage(raw: string, fallbackCode?: string): string {
  const singleLine = raw.replace(/\s+/g, ' ').trim();
  const text = singleLine || fallbackCode || 'Erreur inconnue.';
  return text.length <= MAX_ERROR_MESSAGE_LENGTH
    ? text
    : `${text.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...`;
}

/**
 * Extrait les champs d'erreur utiles d'une exception.
 *
 * N'importe quelle erreur devient observable sans jamais copier de contenu
 * de prompt : seule la signature de l'erreur est retenue.
 */
export function describeError(error: unknown): {
  errorCode?: string;
  errorMessage: string;
} {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    const errorCode =
      typeof code === 'string' && code.trim() ? code : error.name || 'Error';
    return { errorCode, errorMessage: error.message };
  }

  return { errorMessage: typeof error === 'string' ? error : 'Erreur inconnue.' };
}

/**
 * Marque une erreur dont la cause est une DEPENDANCE EXTERNE (provider).
 *
 * Une seule propriete interne, jamais exposee comme code : `describeError`
 * ignore cette marque, donc le code operationnel d'une panne de modele reste
 * intact. La marque sert uniquement a classer l'echec en `DEPENDENCY` au
 * niveau de la mission, sans creer de classe d'erreur supplementaire.
 *
 * L'objet d'origine est renvoye tel quel : le message, le nom et le type de
 * l'erreur sont conserves, aucune identite n'est ecrasee.
 */
const DEPENDENCY_ORIGIN = 'gnoxeOrigin';

export function markDependencyError<T>(error: T): T {
  if (error && (typeof error === 'object' || typeof error === 'function')) {
    try {
      const carrier = error as Record<string, unknown>;
      if (carrier[DEPENDENCY_ORIGIN] === undefined) {
        carrier[DEPENDENCY_ORIGIN] = 'dependency';
      }
    } catch {
      // Objet fige : la marque est un confort de classement, pas une exigence.
    }
  }
  return error;
}

/** Verifie la marque posee par `markDependencyError`. */
export function isDependencyError(error: unknown): boolean {
  return Boolean(
    error &&
      (typeof error === 'object' || typeof error === 'function') &&
      (error as Record<string, unknown>)[DEPENDENCY_ORIGIN] === 'dependency'
  );
}
