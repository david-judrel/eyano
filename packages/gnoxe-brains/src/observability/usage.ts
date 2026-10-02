/**
 * Contrat d'USAGE des modeles.
 *
 * Responsabilite unique : decrire CE QUI A ETE CONSOMME par un appel modele.
 * C'est la moitie "constat" de la telemetrie ; l'autre moitie, le TARIF
 * (prix, devise, cout calcule), n'appartient pas ici et reste une
 * responsabilite superieure applicative.
 *
 * Regles du contrat :
 * - strictement generique : aucun nom de fournisseur, aucun nom de SDK,
 *   aucune reference a une cle API ni a un transport ;
 * - aucun champ obligatoire de tokens : un backend qui ne fournit pas le
 *   decompte laisse le champ absent. Jamais de valeur fabriquee, jamais
 *   d'estimation presentee comme un constat ;
 * - `model` et `provider` sont renseignes par l'appelant qui connait la
 *   reponse, jamais deduits d'un nom de fichier ou d'une cle.
 */

/**
 * Usage constate d'UN appel modele.
 *
 * Une entree = un appel. Agreger un ensemble d'entrees est le role de
 * `aggregateUsage`, jamais de l'appelant isole.
 */
export interface ModelUsage {
  /** Identifiant logique effectivement utilise (`gnoxe-brains-*`). */
  model: string;
  /** Nom du backend reellement utilise. Donnee INTERNE, jamais exposee en API. */
  provider: string;
  /**
   * Tokens d'entree rapportes par le backend.
   * ABSENT lorsque le backend ne fournit aucun decompte.
   */
  inputTokens?: number;
  /** Tokens de sortie rapportes par le backend. ABSENT si non fourni. */
  outputTokens?: number;
  /** Tokens totaux rapportes par le backend. ABSENT si non fourni. */
  totalTokens?: number;
}

/**
 * Usage agrege d'un ensemble d'appels.
 *
 * Chaque entree fournie compte exactement UNE fois dans `calls` : aucune
 * dedoublonnage par identite (deux appels reels sont deux appels), aucune
 * addition d'une meme entree presentee deux fois.
 *
 * `callsWithTokens` distingue le nombre d'appels reels du nombre d'appels
 * ayant effectivement fourni un decompte : un total de tokens n'est jamais
 * presentable comme exhaustif si `callsWithTokens < calls`.
 */
export interface UsageTotals {
  /** Nombre d'appels dont un usage a ete rapporte. */
  calls: number;
  /** Parmi eux, nombre d'appels ayant fourni au moins un decompte. */
  callsWithTokens: number;
  /** Somme des `inputTokens` fournis. Absent si aucun appel n en fournit. */
  inputTokens?: number;
  /** Somme des `outputTokens` fournis. Absent si aucun appel n en fournit. */
  outputTokens?: number;
  /**
   * Somme des `totalTokens` fournis ; a defaut, `inputTokens + outputTokens`
   * lorsque les deux sommes existent. Absent dans les autres cas.
   */
  totalTokens?: number;
}

/**
 * Aggrege des usages de plusieurs appels en un total deterministe.
 *
 * Garanties :
 * - DETERMINISTE : le resultat ne depend ni de l'ordre fourni, ni de la
 *   reference des objets, ni de l'horloge. Une entree nulle ou indeterminee est
 *   ignoree et ne compte ni comme appel, ni comme token.
 * - SANS DOUBLE COMPTEMENT : chaque entree est parcourue une seule fois ;
 *   la fonction ne lit jamais deux fois le meme objet et ne mute pas son
 *   argument.
 * - SANS FABRICATION : un champ n'est produit que si au moins une entree
 *   l'a fourni. Un total partiel reste lisible via `callsWithTokens`.
 *
 * Retourne `undefined` quand aucun usage n'a ete observe : l'absence
 * d'information est un resultat a part entiere, pas un zero.
 */
export function aggregateUsage(
  usages: readonly (ModelUsage | null | undefined)[]
): UsageTotals | undefined {
  const entries = (usages ?? []).filter((entry): entry is ModelUsage => Boolean(entry));
  if (entries.length === 0) return undefined;

  let callsWithTokens = 0;
  let inputSum = 0;
  let hasInput = false;
  let outputSum = 0;
  let hasOutput = false;
  let totalSum = 0;
  let hasTotal = false;

  for (const entry of entries) {
    const providesAny =
      entry.inputTokens !== undefined ||
      entry.outputTokens !== undefined ||
      entry.totalTokens !== undefined;
    if (providesAny) callsWithTokens += 1;

    if (entry.inputTokens !== undefined) {
      hasInput = true;
      inputSum += entry.inputTokens;
    }
    if (entry.outputTokens !== undefined) {
      hasOutput = true;
      outputSum += entry.outputTokens;
    }
    if (entry.totalTokens !== undefined) {
      hasTotal = true;
      totalSum += entry.totalTokens;
    }
  }

  const totals: UsageTotals = { calls: entries.length, callsWithTokens };
  if (hasInput) totals.inputTokens = inputSum;
  if (hasOutput) totals.outputTokens = outputSum;

  if (hasTotal) {
    totals.totalTokens = totalSum;
  } else if (hasInput && hasOutput) {
    totals.totalTokens = inputSum + outputSum;
  }

  return totals;
}
