import { ChatMessage } from '@eyano/types';

/**
 * Provenance Check (etape 38).
 *
 * Le Recall Resolver (e35-e37) repond a "qu'as-tu dit au tour N ?" : une
 * POSITION est connue, le code va chercher le message. Ce module repond a
 * l'autre question, celle du probe C : "tu m'avais dit que X, c'est bien
 * ca ?". Aucune position : l'utilisateur ATTRIBUE un contenu au modele.
 *
 * Le modele confond trois faits : X est vrai de son identite, X est dans
 * son contexte, X a ete dit dans cette conversation. Seul le troisieme est
 * en jeu, et le modele ne peut pas le verifier : les premiers tours sont
 * hors fenetre. Le code, lui, a l'historique complet.
 *
 * Il CHERCHE, il ne juge pas. Recherche lexicale deterministe, trois
 * issues (FOUND / PARTIAL / NOT_FOUND), jamais de score transmis au modele :
 * un recouvrement de mots n'est pas une equivalence de sens, c'est au
 * modele d'interpreter le candidat cite.
 *
 * Generique : ni identite, ni marque. On ne cherche que dans les reponses
 * assistant de l'historique fourni, jamais dans le system prompt (e38 ne
 * teste que la preuve conversationnelle ; l'identite serait une autre
 * variable).
 */

export const PROVENANCE_CHECK_HEAD = 'PROVENANCE CHECK';

/**
 * Seuils FIGES avant les runs d'e38. Part des mots porteurs de
 * l'affirmation retrouves dans une meme reponse assistant.
 */
export const PROVENANCE_FOUND_COVERAGE = 0.8;
export const PROVENANCE_PARTIAL_COVERAGE = 0.4;

/** Longueur maximale d'une reponse citee dans le bloc. */
const QUOTE_LIMIT = 800;

/**
 * "tu m'avais dit que", "tu as expliqué que", "tu me disais que"...
 * Volontairement petit : une absence de detection laisse le comportement
 * e37 intact.
 */
const CLAIM_PATTERNS = [
  /\btu\s+(?:m['’]|me\s+|nous\s+)?(?:avais|as)\s+(?:dit|affirm[eé]|expliqu[eé]|racont[eé]|assur[eé]|[eé]crit|promis|conseill[eé]|r[eé]pondu)\s+(?:que\s+|qu['’]\s*)(.+)$/i,
  /\btu\s+(?:me\s+|nous\s+)?disais\s+(?:que\s+|qu['’]\s*)(.+)$/i,
];

/** Queue de question qui ne fait pas partie du contenu attribue. */
const TAIL =
  /[\s,;]*(?:c['’]est\s+bien\s+(?:[cç]a|cela)|n['’]est-ce\s+pas|pas\s+vrai|non|hein|right)?\s*[?.!]*\s*$/i;

/** Mots outils : ils ne prouvent rien sur la provenance. */
const STOPWORDS = new Set(
  (
    'que qui quoi les des une un le la de du et ou mais donc car ni pour par avec sans sur sous dans entre vers chez ' +
    'tu te toi ton ta tes je me moi mon ma mes il elle on nous vous ils elles leur leurs lui son sa ses ce cet cette ces ' +
    'est etait etais es suis sont etre ete avoir avais avait as ai ont peux peut pouvais pouvait pourrais faut fallait ' +
    'fait faire plus moins tres bien aussi comme tout tous toute toutes pas ne non oui cela ceci quand alors ainsi ' +
    'qu au aux en y c d l j m n s t'
  ).split(' ')
);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’ʼ]/g, "'");
}

/**
 * Mots porteurs, reduits a un prefixe de 5 lettres : "analyser" et
 * "analyse" se rejoignent sans dictionnaire ni modele.
 */
export function provenanceStems(text: string): string[] {
  const stems = new Set<string>();
  for (const word of normalize(text).split(/[^a-z0-9]+/)) {
    if (word.length < 3 || STOPWORDS.has(word)) continue;
    stems.add(word.slice(0, 5));
  }
  return [...stems];
}

/**
 * Contenu attribue au modele, tel qu'ecrit par l'utilisateur, ou `null`.
 */
export function detectProvenanceClaim(raw: string): string | null {
  for (const pattern of CLAIM_PATTERNS) {
    const match = pattern.exec(raw);
    if (!match) continue;

    const claim = match[1].replace(TAIL, '').trim();
    if (provenanceStems(claim).length > 0) return claim;
  }
  return null;
}

export interface ProvenanceEvidence {
  claim: string;
  status: 'found' | 'partial' | 'not_found';
  /** Reponses assistant examinees, historique COMPLET, question exclue. */
  searched: number;
  /** Meilleur candidat (FOUND ou PARTIAL). */
  turn?: number;
  position?: number;
  visible?: boolean;
  reply?: string;
}

/**
 * Recherche pure dans l'historique complet.
 *
 * Le meilleur candidat est la reponse assistant qui couvre la plus grande
 * part des mots porteurs de l'affirmation ; a egalite, la plus ancienne.
 * Son tour est celui du dernier message utilisateur qui la precede.
 */
export function checkProvenance(
  messages: ChatMessage[],
  claim: string,
  maxContextMessages: number
): ProvenanceEvidence {
  const claimStems = provenanceStems(claim);
  const total = messages.length;
  const firstVisible = total - Math.min(maxContextMessages, total) + 1;

  let searched = 0;
  let turn = 0;
  let best: { coverage: number; turn: number; position: number } | null = null;

  for (let position = 1; position <= total; position += 1) {
    const message = messages[position - 1];
    if (message.role === 'user') {
      turn += 1;
      continue;
    }
    if (message.role !== 'assistant') continue;

    searched += 1;
    const replyStems = new Set(provenanceStems(message.content));
    const shared = claimStems.filter((stem) => replyStems.has(stem)).length;
    const coverage = claimStems.length === 0 ? 0 : shared / claimStems.length;

    if (!best || coverage > best.coverage) best = { coverage, turn, position };
  }

  if (!best || best.coverage < PROVENANCE_PARTIAL_COVERAGE) {
    return { claim, status: 'not_found', searched };
  }

  return {
    claim,
    status: best.coverage >= PROVENANCE_FOUND_COVERAGE ? 'found' : 'partial',
    searched,
    turn: best.turn,
    position: best.position,
    visible: best.position >= firstVisible,
    reply: messages[best.position - 1].content,
  };
}

/**
 * Anglais volontaire, comme le Recall Lookup : une donnee de transport,
 * pas une regle. Aucun score, aucun verdict de sens.
 */
export function formatProvenanceCheck(evidence: ProvenanceEvidence): string {
  const lines = [
    PROVENANCE_CHECK_HEAD,
    '',
    `Claimed assistant statement: "${evidence.claim}"`,
    `Searched: all ${evidence.searched} previous assistant replies of this conversation, including those not in the visible context`,
    'Method: word overlap search, not a judgement of meaning',
  ];

  if (evidence.status === 'not_found') {
    lines.push('Conversation evidence: NOT_FOUND');
    return lines.join('\n');
  }

  const where = `turn ${evidence.turn}${evidence.visible ? '' : ' (not in the visible context)'}`;
  if (evidence.status === 'found') {
    lines.push('Conversation evidence: FOUND');
    lines.push(`Matching assistant reply: ${where}`);
  } else {
    lines.push('Conversation evidence: PARTIAL');
    lines.push(`Closest assistant reply: ${where}`);
  }
  lines.push(`"${quote(evidence.reply || '')}"`);

  return lines.join('\n');
}

function quote(text: string): string {
  return text.length > QUOTE_LIMIT ? `${text.slice(0, QUOTE_LIMIT)}…` : text;
}

/**
 * Bloc a joindre au point de contact, ou `null` sans affirmation de
 * provenance. Detection sur la question brute, recherche sur `messages`
 * (historique complet) sans la question elle-meme.
 */
export function buildProvenanceCheck(
  visible: ChatMessage[],
  messages: ChatMessage[],
  maxContextMessages: number
): string | null {
  const last = visible[visible.length - 1];
  if (!last || last.role !== 'user') return null;

  const claim = detectProvenanceClaim(last.content);
  if (claim === null) return null;

  return formatProvenanceCheck(checkProvenance(messages, claim, maxContextMessages));
}
