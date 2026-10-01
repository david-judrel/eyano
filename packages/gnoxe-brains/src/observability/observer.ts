import { ObservationEvent, publicErrorMessage } from './events';

/**
 * Contrat d'observation operationnelle.
 *
 * Implementable par l'appelant : journal local, metrique en memoire,
 * export vers un systeme existant. Aucune implementation externe n'est
 * imposee et aucun reseau n'est requis.
 */
export interface MissionObserver {
  observe(event: ObservationEvent): void;
}

/**
 * Observation sans effet (implementation par defaut).
 *
 * GnoxeBrains fonctionne sans systeme de logging : brancher un observateur
 * est optionnel, et son retrait rend exactement le comportement historique.
 */
export const noopObserver: MissionObserver = Object.freeze({
  observe(): void {
    /* aucun effet */
  },
});

/**
 * Publie un evenement sans jamais laisser un observateur en echec interrompre
 * l'execution. L'observation est un service accessoire : elle ne doit pas
 * pouvoir faire echouer une mission, une etape ou un tool.
 *
 * Derniere garantie de signature publique : un message d'erreur multiligne
 * (stack trace, corps HTTP) est ramene a une ligne unique et bornee avant
 * d'atteindre l'observateur. Les autres champs sont transmis a l'identique.
 */
export function safeObserve(
  observer: MissionObserver | undefined,
  event: ObservationEvent
): void {
  if (!observer) return;

  const delivered: ObservationEvent = event.errorMessage
    ? { ...event, errorMessage: publicErrorMessage(event.errorMessage) }
    : event;

  try {
    observer.observe(delivered);
  } catch {
    /* un observateur en echec n'interrompt rien */
  }
}

/**
 * Observateur local : conserve les evenements en memoire.
 *
 * Utile pour les tests et pour l'inspection en processus. Bornage volontaire
 * pour qu'une mission longue ne devienne jamais une fuite de memoire.
 * Ce n'est PAS une telemetrie : rien ne quitte le processus.
 */
export class MemoryObserver implements MissionObserver {
  readonly events: ObservationEvent[] = [];

  constructor(private readonly maxEvents: number = 1000) {}

  observe(event: ObservationEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  filter(predicate: (event: ObservationEvent) => boolean): ObservationEvent[] {
    return this.events.filter(predicate);
  }

  /** Evenements d'une portee donnee, dans l'ordre d'emission. */
  scope(scope: ObservationEvent['scope']): ObservationEvent[] {
    return this.events.filter((event) => event.scope === scope);
  }

  of(status: ObservationEvent['status']): ObservationEvent[] {
    return this.events.filter((event) => event.status === status);
  }

  clear(): void {
    this.events.length = 0;
  }
}

/**
 * Contexte optionnel transmis au `ToolRegistry` lors d'une invocation.
 *
 * Sans `observer` ou sans `missionId`, aucun evenement n'est emis : le
 * registre conserve alors exactement son comportement historique.
 */
export interface ToolExecutionContext {
  /** Mission dont depend l'invocation. */
  missionId?: string;
  /** Agent qui declenche l'invocation. */
  agentId?: string;
  /** Observateur a prevenir des evenements `tool`. */
  observer?: MissionObserver;
}
