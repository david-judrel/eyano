import type { ModelRequest } from '../providers/model-provider';

/**
 * ENVELOPPE D EXECUTION autorisee par le moteur.
 *
 * bornes declaratives du MOTEUR, pas des backends : elles disent ce que
 * GnoxeBrains accepte d envoyer, jamais ce qu un adaptateur accepte de
 * recevoir. Elles sont figees, jamais lues depuis une variable
 * d environnement, jamais modifiees a l execution.
 *
 * Aucune borne haute n est posee sur `maxTokens` : la question "ce modele
 * porte-t-il assez de jetons ?" appartient au ModelResolver (etape 20).
 * Ici, seule la forme du nombre est jugeee.
 */
export const EXECUTION_BOUNDS = Object.freeze({
  temperature: Object.freeze({ min: 0, max: 2 }),
  maxTokens: Object.freeze({ min: 1 }),
});

/**
 * CODES D EXECUTION.
 *
 * Un code par parametre, dans l ordre de lecture de `validate()`.
 * Aucun code ne partage de valeur avec `GnoxeBrainsErrorCode`,
 * `OrchestratorErrorCode`, `ToolRegistryErrorCode` ni
 * `ModelResolutionErrorCode` / `ProviderCapabilityErrorCode`.
 */
export type ExecutionErrorCode =
  | 'EXECUTION_STREAMING_INVALID'
  | 'EXECUTION_STRUCTURED_OUTPUT_INVALID'
  | 'EXECUTION_TEMPERATURE_INVALID'
  | 'EXECUTION_MAX_TOKENS_INVALID';

/**
 * Refus d execution : un parametre demande est invalide.
 *
 * Le message porte le nom du parametre et la valeur reelle attendue.
 * Aucun nom de backend, aucun nom de modele : la regle appartient au
 * moteur, pas a l adaptateur qui l appliquera plus tard.
 */
export class ExecutionPolicyError extends Error {
  constructor(
    readonly code: ExecutionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ExecutionPolicyError';
  }
}

/**
 * Parametres d execution demandes par l appelant.
 *
 * `streaming` et `structuredOutput` sont des MODES declares, pas des
 * valeurs a transmettre : ils disent ce que la methode appelante va faire
 * du resultat. `temperature` et `maxTokens` sont des VALEURS, jugees puis
 * rendues strictement telles quelles.
 */
export interface ExecutionRequest {
  /**
   * Mode impose par la methode : `answer()` declare `false`,
   * `answerStream()` declare `true`. Obligatoire : aucune methode ne peut
   * oublier de declarer ce qu elle execute.
   */
  streaming: boolean;
  /**
   * Sortie structuree demandee (contrat `ModelProvider.structuredOutput`).
   * Absent = non structurant. Le mode n est jamais deduit silencieusement
   * d un autre parametre.
   */
  structuredOutput?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Parametres valides : la seule source transmise au provider.
 *
 * `providerParameters` est construit ici, une fois pour toutes, afin
 * qu `answer()` et `answerStream()` ne puissent ni diverger dans les
 * champs envoyes, ni corriger une valeur en chemin.
 */
export interface ExecutionParameters {
  readonly streaming: boolean;
  readonly structuredOutput: boolean;
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Champs `ModelRequest` valides, evalues a l identique. */
  readonly providerParameters: Readonly<Pick<ModelRequest, 'temperature' | 'maxTokens'>>;
}

/**
 * POLICE D EXECUTION - premiere porte du pipeline d execution, avant la
 * resolution de modele et avant toute capacite provider.
 *
 * Repond a une seule question : "ces parametres d execution sont-ils
 * exploitables tels quels ?"
 *
 * Ce que cette couche fait :
 * - declarer, un seul endroit, l ensemble des parametres d execution
 *   autorises (`temperature`, `maxTokens`, `streaming`, `structuredOutput`) ;
 * - refuser toute valeur invalide, avant le moindre appel reseau ;
 * - rendre les parametres valides sans jamais les corriger, completer ni
 *   arrondir : une valeur demandee est envoyee, une valeur absente reste
 *   absente (c est l adaptateur, jamais ici, qui choisit un defaut).
 *
 * Ce qu'elle ne fait JAMAIS :
 * - choisir une valeur a la place de l appelant (aucun defaut injecte,
 *   aucun ecrasement silencieux, aucun arrondi de temperature) ;
 * - appliquer un budget de tokens (la capacite du modele reste le travail
 *   du ModelResolver, la capacite du provider reste celle de la couche de
 *   capacites) ;
 * - negocier, optimiser, adapter selon le cout, la latence ou le modele ;
 * - toucher au provider : cette couche n importe aucun adaptateur.
 *
 * Ordre de decision, fixe et immutable :
 *   1. mode `streaming` : doit etre un booleen ;
 *   2. mode `structuredOutput` : absent vaut `false`, sinon booleen ;
 *   3. `temperature` : absent ignore, sinon nombre fini dans
 *      `EXECUTION_BOUNDS.temperature` ;
 *   4. `maxTokens` : absent ignore, sinon entier strictement superieur ou
 *      egal a `EXECUTION_BOUNDS.maxTokens.min`.
 */
export class ExecutionPolicy {
  validate(request: ExecutionRequest): ExecutionParameters {
    if (typeof request.streaming !== 'boolean') {
      throw new ExecutionPolicyError(
        'EXECUTION_STREAMING_INVALID',
        `Mode streaming invalide : ${String(request.streaming)}. Attendu un booleen.`
      );
    }

    const structuredOutput = request.structuredOutput ?? false;

    if (typeof structuredOutput !== 'boolean') {
      throw new ExecutionPolicyError(
        'EXECUTION_STRUCTURED_OUTPUT_INVALID',
        `Mode structuredOutput invalide : ${String(request.structuredOutput)}. Attendu un booleen.`
      );
    }

    const temperature = request.temperature;

    if (temperature !== undefined) {
      if (
        typeof temperature !== 'number' ||
        !Number.isFinite(temperature) ||
        temperature < EXECUTION_BOUNDS.temperature.min ||
        temperature > EXECUTION_BOUNDS.temperature.max
      ) {
        throw new ExecutionPolicyError(
          'EXECUTION_TEMPERATURE_INVALID',
          `Temperature invalide : ${String(temperature)}. Attendu un nombre fini entre ${EXECUTION_BOUNDS.temperature.min} et ${EXECUTION_BOUNDS.temperature.max}.`
        );
      }
    }

    const maxTokens = request.maxTokens;

    if (maxTokens !== undefined) {
      if (
        typeof maxTokens !== 'number' ||
        !Number.isFinite(maxTokens) ||
        !Number.isInteger(maxTokens) ||
        maxTokens < EXECUTION_BOUNDS.maxTokens.min
      ) {
        throw new ExecutionPolicyError(
          'EXECUTION_MAX_TOKENS_INVALID',
          `maxTokens invalide : ${String(maxTokens)}. Attendu un entier superieur ou egal a ${EXECUTION_BOUNDS.maxTokens.min}.`
        );
      }
    }

    return Object.freeze({
      streaming: request.streaming,
      structuredOutput,
      temperature,
      maxTokens,
      providerParameters: Object.freeze({ temperature, maxTokens }),
    });
  }
}

/** Instance unique : une police sans etat, sans memoire, sans historique. */
export const executionPolicy = new ExecutionPolicy();
