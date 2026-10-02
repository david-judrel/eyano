import { ChatMessage } from '@eyano/types';

/**
 * Fenetre visible exprimee en TOURS (etape 37).
 *
 * e36 a montre qu'une plage en positions de message ("messages 8 a 27")
 * est relue par le modele comme une plage de tours ("avant le huitieme
 * tour"), meme accompagnee de la plage de tours correcte. Le modele parle
 * en tours : on ne lui annonce plus que des tours.
 *
 * Fonction pure, separee du resolver : `resolveRecallTurn` et
 * `detectRecallTurn` restent ceux qui ont produit les resultats d'e36.
 */
export interface VisibleTurns {
  /** Nombre de messages utilisateur dans l'historique complet. */
  turnCount: number;
  /** Premier et dernier tour dont le message utilisateur est visible. */
  first: number | null;
  last: number | null;
  /**
   * Tour dont seule la REPONSE est visible, en tete de fenetre : sa
   * question a ete evincee. `null` si la fenetre commence par un message
   * utilisateur ou par autre chose qu'une reponse.
   */
  partialTurn: number | null;
}

export function describeVisibleTurns(
  messages: ChatMessage[],
  maxContextMessages: number,
  firstTurn: number = 1
): VisibleTurns {
  const total = messages.length;
  const firstVisible = total - Math.min(maxContextMessages, total) + 1;

  // Etape 41 : numerotation REELLE. Les tours supprimes par l'appelant
  // precedent l'historique fourni ; ils comptent, sans etre visibles.
  let turnCount = firstTurn - 1;
  let first: number | null = null;
  let last: number | null = null;
  for (let position = 1; position <= total; position += 1) {
    if (messages[position - 1].role !== 'user') continue;
    turnCount += 1;
    if (position >= firstVisible) {
      if (first === null) first = turnCount;
      last = turnCount;
    }
  }

  // Une reponse en tete de fenetre appartient au dernier tour evince, que
  // sa question ait quitte la fenetre (e37) ou le stockage (e41).
  const head = messages[firstVisible - 1];
  const evicted = first === null ? turnCount : first - 1;
  const partialTurn = head && head.role === 'assistant' && evicted > 0 ? evicted : null;

  return { turnCount, first, last, partialTurn };
}

/** `[1, 4]` -> `1-4`, `[3, 3]` -> `3`. */
export function formatTurnSpan(from: number, to: number): string {
  return from === to ? `${from}` : `${from}-${to}`;
}

/** Tours dont le message utilisateur n'est pas fourni, ou `null`. */
export function missingTurns(turns: VisibleTurns): [number, number] | null {
  const evicted = turns.first === null ? turns.turnCount : turns.first - 1;
  return evicted > 0 ? [1, evicted] : null;
}
