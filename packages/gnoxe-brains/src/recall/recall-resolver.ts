import { ChatMessage } from '@eyano/types';
import { formatTurnSpan, missingTurns } from './visible-turns';
import { HistoryCoverage, deletedTurns, normalizeCoverage } from './history-coverage';

/**
 * Recall Resolver (etapes 35-36).
 *
 * OPERATION SEPAREE DE LA GENERATION. Jusqu'a e34, le modele devait deviner
 * lui-meme quelle position de l'historique correspond au "tour 8", puis
 * decider si elle etait visible. e32 (regle dans les situations), e33
 * (bornes de fenetre dans le system) et e34 (garde au point de contact)
 * ont montre que la contrainte placee localement empeche d'inventer, mais
 * ne produit jamais la recuperation : a'' reste 0/3, toujours en refus.
 *
 * Ici, aucun modele : une fonction pure lit l'historique complet, retrouve
 * le message, et rend le resultat sous une forme que le modele n'a plus a
 * deviner. Le cerveau recoit des faits, pas une nouvelle regle.
 *
 * e36 : un tour n'est plus un message mais une paire (user, assistant), et
 * la question designe une CIBLE dans cette paire. "tu m'as repondu quoi au
 * premier tour ?" recevait jusqu'ici la question de l'utilisateur.
 *
 * Genrique : ni marque, ni identite. Un contrat d'interrogation de
 * l'historique fourni, comme le module voisin `recall-guard`.
 */

export const RECALL_LOOKUP_HEAD = 'RECENT CONTEXT LOOKUP';

/** Provenance d'un message restitue hors fenetre (etape 42). */
export const STORED_SOURCE = 'stored history, not in the visible context';

/** Ordinals francais, accents retires avant comparaison. */
const ORDINALS = [
  'premier|premiere',
  'deuxieme',
  'troisieme',
  'quatrieme',
  'cinquieme',
  'sixieme',
  'septieme',
  'huitieme',
  'neuvieme',
  'dixieme',
  'onzieme',
  'douzieme',
  'treizieme',
  'quatorzieme',
  'quinzieme',
  'seizieme',
  'dix-septieme',
  'dix-huitieme',
  'dix-neuvieme',
  'vingtieme',
];

/** Nom qui peut porter un numero de tour. */
const SUPPORT = 'tour|question|message|echange';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’ʼ]/g, "'");
}

/**
 * Retrouve le numero de tour demande dans la derniere question.
 *
 * Deterministe et volontairement restrictif : une fausse detection injecte
 * un bloc inutile, une absence de detection laisse le comportement e34
 * intact. L'accent est retire avant coup, ce qui evite le piege `\b` sur
 * les caracteres non ASCII deja rencontre a l'etape 33.
 */
export function detectRecallTurn(raw: string): number | null {
  const text = normalize(raw);

  const byTour = new RegExp(`\\btour\\s*(?:n\\s*[o°]?\\s*|\\#\\s*)?(\\d{1,3})\\b`).exec(text);
  if (byTour) {
    const turn = Number(byTour[1]);
    if (turn > 0) return turn;
  }

  for (let index = 0; index < ORDINALS.length; index += 1) {
    const pattern = new RegExp(`\\b(?:${ORDINALS[index]})\\s+(?:${SUPPORT})\\b`);
    if (pattern.test(text)) return index + 1;
  }

  const byDigit = new RegExp(`\\b(\\d{1,3})(?:eme|er|ere|e)?\\s+(?:${SUPPORT})\\b`).exec(text);
  if (byDigit) {
    const turn = Number(byDigit[1]);
    if (turn > 0 && turn <= 100) return turn;
  }

  return null;
}

/** Partie du tour visee par la question. */
export type RecallTarget = 'user' | 'assistant' | 'both';

/** "on disait", "notre echange" : la paire entiere. */
const BOTH_CUES = [
  /\bon\s+(?:se\s+)?(?:disait|a\s+dit|s'est\s+dit|parlait|echangeait)\b/,
  /\bnous\s+(?:disions|avons\s+dit|parlions)\b/,
  /\bnotre\s+(?:echange|conversation|discussion)\b/,
];

/** L'utilisateur parle de ce qu'IL a dit. */
const USER_CUES = [
  /\b(?:je|j')\s*(?:t'|te\s+|vous\s+)?(?:ai|avais)\s+(?:dit|demande|ecrit|pose|raconte)\b/,
  /\bt-ai-je\s+(?:dit|demande|ecrit)\b/,
  /\b(?:ma|mes|mon)\s+(?:\w+\s+){0,2}(?:questions?|messages?|demandes?)\b/,
];

/** L'utilisateur parle de ce que le modele a dit. */
const ASSISTANT_CUES = [
  /\btu\s+(?:m'|me\s+|nous\s+)?(?:as|avais)\s+(?:repondu|dit|explique|ecrit|raconte|propose)\b/,
  /\bt'as\s+(?:repondu|dit|explique)\b/,
  /\b(?:m'|nous\s+)?as-tu\s+(?:repondu|dit|explique)\b/,
  /\b(?:ta|tes|votre)\s+(?:\w+\s+){0,2}reponses?\b/,
  /\brepondu\b/,
];

/**
 * Cible du rappel, petite et deterministe.
 *
 * Indices explicites des deux cotes, ou formulation collective -> `both`.
 * Sans indice de personne, "question" et "demande" designent ce que
 * l'utilisateur a pose. Rien du tout -> `both` : en cas de doute, on donne
 * la paire plutot que de choisir a la place du modele.
 */
export function detectRecallTarget(raw: string): RecallTarget {
  const text = normalize(raw);

  if (BOTH_CUES.some((cue) => cue.test(text))) return 'both';

  const user = USER_CUES.some((cue) => cue.test(text));
  const assistant = ASSISTANT_CUES.some((cue) => cue.test(text));

  if (user && assistant) return 'both';
  if (assistant) return 'assistant';
  if (user) return 'user';
  if (/\b(?:questions?|demandes?)\b/.test(text)) return 'user';

  return 'both';
}

/**
 * Etat d'une partie du tour.
 *
 * `no_reply` est un FAIT, pas une absence d'information : le message
 * utilisateur du tour est connu et aucun message assistant ne le suit.
 * Le distinguer de `not_available` empeche de fabriquer une reponse.
 */
export interface RecallPart {
  status: 'found' | 'not_available' | 'no_reply';
  position?: number;
  content?: string;
  /**
   * Etape 42 : trouve dans l'historique STOCKE mais hors de la fenetre
   * transmise au modele. Absent pour un message visible (bloc e35 intact).
   */
  outsideWindow?: true;
}

export interface RecallLookup {
  turn: number;
  target: RecallTarget;
  /** Statut du message UTILISATEUR du tour (contrat e35). */
  status: 'found' | 'not_available';
  /**
   * `unknown_turn` : le tour n'existe pas. `out_of_window` : existe, evince
   * de la fenetre. `deleted` : existe, supprime du stockage par l'appelant
   * (e41). `unknown_numbering` : historique tronque sans trace, aucun numero
   * de tour n'est fiable (e41).
   */
  reason?: 'unknown_turn' | 'out_of_window' | 'deleted' | 'unknown_numbering';
  messagePosition?: number;
  message?: string;
  /** Le tour complet. `assistant` suit la definition structurelle du tour. */
  user: RecallPart;
  assistant: RecallPart;
  visibleFirst: number;
  visibleLast: number;
  turnCount: number;
  /** Bornes en NUMERO DE TOUR, distinctes des bornes en position de message. */
  visibleTurnFirst: number | null;
  visibleTurnLast: number | null;
  /** Tours supprimes du stockage avant l'historique fourni ; `null` : inconnu. */
  deletedTurns: number | null;
}

/**
 * Resolution pure : tour -> positions reelles dans l'historique complet,
 * puis test d'appartenance a la fenetre visible.
 *
 * Un tour designe le k-ieme message utilisateur, pas la position 2k-1 :
 * le decoupage reel est ainsi respecte meme si l'historique n'est pas
 * strictement alterne. Sa reponse est le premier message assistant APRES
 * ce message utilisateur et AVANT le message utilisateur suivant ; s'il
 * n'y en a pas, le tour n'a pas de reponse.
 *
 * Les deux systemes de coordonnees sont rendus separesment. Les confondre
 * (etape 36) a fait dire au modele que l'historique "commencait au huitieme
 * tour" alors qu'il commencait au huitieme MESSAGE, soit au tour 5.
 *
 * Etape 41 : les numeros sont des tours REELS. Si l'appelant a supprime
 * des tours (`coverage`), le k-ieme message utilisateur fourni est le tour
 * `firstTurn + k - 1`, jamais le tour k. Sans couverture connue, aucun
 * numero n'est resolu : mieux vaut NOT_AVAILABLE qu'un contenu faux.
 *
 * Etape 42 : un message STOCKE est restitue meme hors fenetre, marque
 * `outsideWindow`. Seul ce qui n'est plus stocke reste NOT_AVAILABLE. La
 * fenetre n'est pas elargie : le modele recoit une donnee, pas un contexte.
 * `storedRecall: false` retablit le contrat e35-e41 (visible seulement),
 * pour le controle experimental uniquement.
 */
export function resolveRecallTurn(
  messages: ChatMessage[],
  turn: number,
  maxContextMessages: number,
  target: RecallTarget = 'user',
  coverage?: HistoryCoverage,
  storedRecall: boolean = true
): RecallLookup {
  const deleted = deletedTurns(normalizeCoverage(coverage));
  const total = messages.length;
  const visible = Math.min(maxContextMessages, total);
  const visibleFirst = total - visible + 1;
  const visibleLast = total;
  const isVisible = (position: number) => position >= visibleFirst && position <= visibleLast;
  const partAt = (position: number): RecallPart => {
    const content = messages[position - 1].content;
    if (isVisible(position)) return { status: 'found', position, content };
    if (storedRecall) return { status: 'found', position, content, outsideWindow: true };
    return { status: 'not_available', position };
  };

  const userPositions: number[] = [];
  for (let index = 0; index < total; index += 1) {
    if (messages[index].role === 'user') userPositions.push(index + 1);
  }

  let visibleTurnFirst: number | null = null;
  let visibleTurnLast: number | null = null;
  const offset = deleted ?? 0;
  for (let index = 0; index < userPositions.length; index += 1) {
    if (isVisible(userPositions[index])) {
      if (visibleTurnFirst === null) visibleTurnFirst = offset + index + 1;
      visibleTurnLast = offset + index + 1;
    }
  }

  const base = {
    turn,
    target,
    visibleFirst,
    visibleLast,
    turnCount: offset + userPositions.length,
    visibleTurnFirst,
    visibleTurnLast,
    deletedTurns: deleted,
  };

  if (deleted === null) {
    return {
      ...base,
      status: 'not_available',
      reason: 'unknown_numbering',
      user: { status: 'not_available' },
      assistant: { status: 'not_available' },
    };
  }

  if (turn < 1 || turn > base.turnCount) {
    return {
      ...base,
      status: 'not_available',
      reason: 'unknown_turn',
      user: { status: 'not_available' },
      assistant: { status: 'not_available' },
    };
  }

  if (turn <= offset) {
    // Question supprimee du stockage. Seule la reponse du DERNIER tour
    // supprime peut subsister, en tete d'historique, avant toute question.
    const orphan =
      turn === offset ? findReply(messages, 0, userPositions[0] ?? total + 1) : null;
    const assistant: RecallPart = orphan === null ? { status: 'not_available' } : partAt(orphan);
    return {
      ...base,
      status: 'not_available',
      reason: 'deleted',
      user: { status: 'not_available' },
      assistant,
    };
  }

  const index = turn - offset - 1;
  const position = userPositions[index];
  const user = partAt(position);

  const replyPosition = findReply(messages, position, userPositions[index + 1] ?? total + 1);
  const assistant: RecallPart =
    replyPosition === null ? { status: 'no_reply' } : partAt(replyPosition);

  if (user.status !== 'found') {
    return { ...base, status: 'not_available', reason: 'out_of_window', user, assistant };
  }

  return {
    ...base,
    status: 'found',
    messagePosition: position,
    message: user.content,
    user,
    assistant,
  };
}

/** Premier assistant strictement entre `from` et `until` (positions 1-based). */
function findReply(messages: ChatMessage[], from: number, until: number): number | null {
  for (let position = from + 1; position < until; position += 1) {
    if (messages[position - 1].role === 'assistant') return position;
  }
  return null;
}

/**
 * Mise en forme du resultat. Anglais volontaire : le bloc se lit comme une
 * donnee de transport, pas comme la parole d'Eyano ni comme une regle.
 *
 * Cible `user` : bloc e35 a l'identique, pour que a'' reste un temoin et
 * que e36 ne mesure que l'apport de la cible assistant.
 */
export function formatRecallLookup(result: RecallLookup): string {
  if (result.target === 'user') return formatUserLookup(result);

  const lines = [RECALL_LOOKUP_HEAD, '', `Requested turn: ${result.turn}`];
  lines.push(
    result.target === 'assistant'
      ? 'Requested content: the assistant reply of that turn'
      : 'Requested content: the user message and the assistant reply of that turn'
  );

  if (result.target === 'both') {
    pushPart(lines, 'USER', 'User message', result.user);
  }
  pushPart(lines, 'ASSISTANT', 'Assistant reply', result.assistant);

  const parts = result.target === 'both' ? [result.user, result.assistant] : [result.assistant];
  if (parts.some((part) => part.status === 'not_available')) {
    pushRanges(lines, result);
  }
  if (parts.some((part) => part.status === 'found')) {
    lines.push('');
    lines.push('Do not alter the retrieved message when answering.');
  }

  return lines.join('\n');
}

function formatUserLookup(result: RecallLookup): string {
  const lines = [
    RECALL_LOOKUP_HEAD,
    '',
    `Requested turn: ${result.turn}`,
    `Status: ${result.status === 'found' ? 'FOUND' : 'NOT_AVAILABLE'}`,
  ];

  if (result.status === 'found') {
    lines.push('Requested content: the user message of that turn');
    // Etape 42 : hors fenetre, une position de STOCKAGE n'apprendrait rien
    // au modele et rejouerait la confusion d'e37 ; on donne la source.
    lines.push(
      result.user.outsideWindow
        ? `Source: ${STORED_SOURCE}`
        : `Message position: ${result.messagePosition}`
    );
    lines.push('Message:');
    lines.push(`"${result.message}"`);
    lines.push('');
    lines.push('Do not alter the retrieved message when answering.');
  } else {
    pushRanges(lines, result);
  }

  return lines.join('\n');
}

/** `USER_FOUND`, `ASSISTANT_NOT_AVAILABLE`, `ASSISTANT_NO_REPLY`... */
function pushPart(lines: string[], prefix: string, label: string, part: RecallPart): void {
  lines.push(`${label}: ${prefix}_${part.status.toUpperCase()}`);

  if (part.status === 'found') {
    lines.push(
      part.outsideWindow ? `${label} source: ${STORED_SOURCE}` : `${label} position: ${part.position}`
    );
    lines.push(`${label} content:`);
    lines.push(`"${part.content}"`);
  } else if (part.status === 'no_reply') {
    lines.push(`${label} absent: no assistant message follows the user message of that turn`);
  }
}

/**
 * Une seule coordonnee : le numero de tour (etape 37).
 *
 * e36 donnait aussi la plage en positions de message ("8-27") ; le modele
 * l'a relue comme une plage de tours. Les positions restent dans le bloc
 * FOUND, attachees a un message precis, jamais sous forme de plage.
 */
function pushRanges(lines: string[], result: RecallLookup): void {
  if (result.deletedTurns === null) {
    lines.push('Turn numbering: unknown (earlier messages were deleted from storage)');
    return;
  }

  const missing = missingTurns({
    turnCount: result.turnCount,
    first: result.visibleTurnFirst,
    last: result.visibleTurnLast,
    partialTurn: null,
  });

  lines.push(`Conversation user turns: ${result.turnCount}`);
  lines.push(`Visible user turns: ${formatTurnRange(result)}`);
  lines.push(`Unavailable user turns: ${missing ? formatTurnSpan(missing[0], missing[1]) : 'none'}`);
  // Etape 41 : distinguer "hors fenetre" (existe, non transmis) de
  // "supprime" (n'existe plus nulle part). Absent si rien n'est supprime.
  if (result.deletedTurns > 0) {
    lines.push(
      `Deleted user turns: ${formatTurnSpan(1, result.deletedTurns)} (removed from storage, cannot be retrieved)`
    );
  }
}

function formatTurnRange(result: RecallLookup): string {
  if (result.visibleTurnFirst === null || result.visibleTurnLast === null) return 'none';
  return formatTurnSpan(result.visibleTurnFirst, result.visibleTurnLast);
}

/**
 * Construit le bloc a joindre au point de contact, ou `null` s'il n'y a
 * rien a resolver.
 *
 * `visible` sert a la detection (question brute, avant toute garde),
 * `messages` est l'historique complet dont seul le cerveau applicatif
 * connait les positions.
 */
export function buildRecallLookup(
  visible: ChatMessage[],
  messages: ChatMessage[],
  maxContextMessages: number,
  coverage?: HistoryCoverage,
  storedRecall: boolean = true
): string | null {
  const last = visible[visible.length - 1];
  if (!last || last.role !== 'user') return null;

  const turn = detectRecallTurn(last.content);
  if (turn === null) return null;

  const target = detectRecallTarget(last.content);
  return formatRecallLookup(resolveRecallTurn(messages, turn, maxContextMessages, target, coverage, storedRecall));
}
