/**
 * Couverture de l'historique fourni (etape 41).
 *
 * e41.0 : un canal qui TRONQUE son stockage (WhatsApp, 30 messages)
 * transmettait un historique partiel que le cerveau prenait pour la
 * conversation entiere. Le resolver numerotait le 12e tour STOCKE comme le
 * tour 12 (et rendait le contenu du tour 22), le check annoncait avoir
 * cherche dans "toute la conversation" : des faits faux, produits par le
 * code.
 *
 * Seul l'appelant sait ce qu'il a supprime. Il le declare ici, en
 * coordonnees de conversation : le numero REEL du tour du premier message
 * utilisateur fourni. Absent, l'historique est complet (comportement
 * e36-e40, inchange au caractere pres).
 */
export interface HistoryCoverage {
  /**
   * Numero reel du tour du premier message utilisateur fourni.
   * `1` : historique complet. `null` : des messages ont ete supprimes et
   * leur nombre n'est pas connu (numerotation impossible).
   */
  firstTurn: number | null;
}

export const COMPLETE_HISTORY: HistoryCoverage = { firstTurn: 1 };

/**
 * Couverture validee : une valeur incoherente (0, negatif, non entier) ne
 * doit jamais produire une numerotation, elle devient inconnue.
 */
export function normalizeCoverage(coverage?: HistoryCoverage | null): HistoryCoverage {
  if (!coverage) return COMPLETE_HISTORY;
  const { firstTurn } = coverage;
  if (firstTurn === null) return { firstTurn: null };
  return Number.isInteger(firstTurn) && firstTurn >= 1 ? { firstTurn } : { firstTurn: null };
}

/** Tours supprimes avant l'historique fourni, ou `null` si inconnu. */
export function deletedTurns(coverage: HistoryCoverage): number | null {
  return coverage.firstTurn === null ? null : coverage.firstTurn - 1;
}

export function isPartialHistory(coverage: HistoryCoverage): boolean {
  return coverage.firstTurn !== 1;
}
