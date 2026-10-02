/**
 * CODES D ECHEC D EXECUTION PROVIDER.
 *
 * Un code par PHASE, jamais par cause : la cause appartient a l erreur
 * originale, la phase appartient au moteur. Aucune valeur n est partagee
 * avec `ExecutionErrorCode` (validation etape 22),
 * `ProviderCapabilityErrorCode` (etape 21) ni `ModelResolutionErrorCode`
 * (etape 20) : une erreur de validation n a jamais le meme code qu une
 * erreur d execution.
 */
export type ProviderExecutionErrorCode =
  /** `generate()` (ou `stream()` a l ouverture) a echoue. */
  | 'PROVIDER_CALL_FAILED'
  /** Echec du flux AVANT le premier fragment rendu a l appelant. */
  | 'PROVIDER_STREAM_FAILED'
  /** Echec du flux APRES au moins un fragment rendu a l appelant. */
  | 'PROVIDER_STREAM_INTERRUPTED';

/**
 * Echec d execution : l appel a eu lieu et le provider a echoue.
 *
 * INVERSE exact d une erreur de validation : dans ce cas il n y a eu aucun
 * appel, et cette exception n est jamais produite.
 *
 * Contrat de preservation :
 * - `message` est STRICTEMENT celui de l erreur originale, ni prefixe ni
 *   reformule : rien n est masque, rien n est generique ;
 * - `cause` est l objet erreur original, reference conservee telle quelle
 *   (jamais clone, jamais reecrit), pour garder son type, son nom, son
 *   code propre et sa pile ;
 * - `code` et `fragmentsDelivered` sont les seuls ajouts : la phase
 *   observee par le moteur, que l erreur originale ne pouvait pas connaitre.
 */
export class ProviderExecutionError extends Error {
  constructor(
    readonly code: ProviderExecutionErrorCode,
    message: string,
    /** Fragments de texte deja rendus a l appelant au moment de l echec. */
    readonly fragmentsDelivered: number,
    options: { cause: unknown }
  ) {
    super(message, options);
    this.name = 'ProviderExecutionError';
  }
}

/** Formule le message original sans jamais l embellir. */
function originalMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  try {
    return String(error);
  } catch {
    return 'Erreur inconnue.';
  }
}

/**
 * RELIABILITY D EXECUTION - contrat des echecs survenus APRES validation.
 *
 * Se place uniquement a l endroit ou le moteur a deja reussi les etapes
 * etapes 20, 21 et 22 : modele resolu, capacites confirmees, parametres
 * valides. Toute exception prise par cette couche est donc, par
 * construction, une panne provider.
 *
 * Ce que cette couche fait :
 * - donner un code d execution deterministe a chaque panne provider ;
 * - conserver l erreur originale intacte dans `cause` et son message
 *   intact dans `message` ;
 * - distinguer l echec avant le premier fragment de l echec en cours de
 *   flux, pour que l appelant sache ce qu il a deja pu afficher.
 *
 * Ce qu'elle ne fait JAMAIS :
 * - reessayer un appel qui a echoue (une tentative, une seule) ;
 * - basculer vers un autre modele, un autre provider, ou relancer une
 *   resolution (la resolution etait deja faite, elle est intangible) ;
 * - cacher l echec derriere une erreur generique ni derriere une valeur
 *   par defaut ;
 * - poser un timeout, un circuit breaker ou une minuterie : aucun de ces
 *   contrats n appartient au provider, le moteur n en invente pas ;
 * - toucher a la telemetrie, au catalog, au resolver ou a la police.
 *
 * Un seul parametre : l operation a executer. Il est invoque UNE fois.
 */
export class ExecutionReliability {
  /**
   * Execute une operation provider et qualifie toute exception en
   * `PROVIDER_CALL_FAILED`.
   *
   * Synchrones et asynchrones sont traites a l identique : l operation est
   * appelee dans le `try`, donc un throw avant la premiere `await` est
   * deja couvert.
   */
  async call<T>(operation: () => T | Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.callFailure(error);
    }
  }

  /** Qualifie un echec d ouverture ou d appel simple. */
  callFailure(error: unknown): ProviderExecutionError {
    if (error instanceof ProviderExecutionError) return error;

    return new ProviderExecutionError('PROVIDER_CALL_FAILED', originalMessage(error), 0, {
      cause: error,
    });
  }

  /**
   * Qualifie un echec de flux selon les fragments deja rendus.
   *
   * `fragmentsDelivered` est le seul temoin du moment de la panne : a
   * zero, l appelant n a rien recu et attend toujours son premier
   * fragment ; au dela, il affiche deja du texte et l interruption est
   * partielle.
   */
  streamFailure(error: unknown, fragmentsDelivered: number): ProviderExecutionError {
    if (error instanceof ProviderExecutionError) return error;

    const delivered = fragmentsDelivered > 0 ? fragmentsDelivered : 0;

    return new ProviderExecutionError(
      delivered > 0 ? 'PROVIDER_STREAM_INTERRUPTED' : 'PROVIDER_STREAM_FAILED',
      originalMessage(error),
      delivered,
      { cause: error }
    );
  }
}

/** Instance unique : aucune minuterie, aucun compteur d echec, aucun etat. */
export const executionReliability = new ExecutionReliability();
