import { ChatMessage } from '@eyano/types';
import { getGnoxeBrains } from '../core/singleton';
import { buildChatContext } from '../prompts/eyano.system';
import { HistoryCoverage } from '../recall/history-coverage';
import { webSearch, buildSearchContext, searchKeywords } from '../tools/web-search.tool';
import { getDefaultModel } from '../models';

export interface ChatFlowInput {
  userId: string;
  conversationId: string;
  messages: ChatMessage[];
  model?: string;
  userName?: string;
  channel?: string;
  /**
   * System instruction fournie par la couche applicative.
   *
   * C'est l'unique porte d'entree de la voix d'Eyano : le cerveau n'en porte
   * aucune. Absente, seul le fragment de session (prenom, canal) formera un
   * system message : jamais une identite.
   */
  systemPrompt?: string;
  /** Voir `ChatContextOptions.recallResolver` : controle experimental. */
  recallResolver?: boolean;
  /** Voir `ChatContextOptions.provenanceCheck` : controle experimental. */
  provenanceCheck?: boolean;
  /**
   * Etape 41 : tours supprimes par l'appelant avant `messages`. Absent :
   * historique complet. Voir `ChatContextOptions.historyCoverage`.
   */
  historyCoverage?: HistoryCoverage;
  /** Voir `ChatContextOptions.recallStoredHistory` : controle experimental. */
  recallStoredHistory?: boolean;
  /** Voir `ChatContextOptions.recallGuard` : defaut conditionnel (Recall V1). */
  recallGuard?: boolean | 'conditional';
}

export interface ChatFlowOutput {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const DEFAULT_MODEL = getDefaultModel();

/**
 * Questions qui dependent de l'actualite ou de faits susceptibles d'avoir
 * change. Volontairement cible : une recherche ajoute quelques secondes, et
 * des resultats hors sujet brouillent la reponse (« comment », « bug »,
 * « cout » — qui matchait « écouter » — ne declenchent plus rien).
 */
const SEARCH_TRIGGERS = [
  /album/i, /chanson/i, /\bclip\b/i, /artiste/i, /musicien/i, /chanteu/i, /concert/i, /\bfilm\b/i, /s[ée]rie/i,
  /derni[eè]re?s?\b/i, /nouveau/i, /nouvelle/i, /r[ée]cent/i,
  /sorti/i, /release/i, /actualit/i, /\bnews\b/i,
  /\bprix\b/i, /tarif/i, /combien co[uû]te/i,
  /\bquand\b/i, /ann[ée]e/i, /aujourd/i, /\bhier\b/i, /cette semaine/i,
  /qui est/i, /c'est qui/i,
  /\bmatch\b/i, /\bscore\b/i, /r[ée]sultat/i, /classement/i, /[ée]lection/i, /pr[ée]sident/i, /ministre/i,
  /202[4-9]/i, /203[0-9]/i,
];

/**
 * Mots-cles d'actualite reconnus malgre une faute de frappe (« dernie »,
 * « albul », « concer »). Seulement a partir de 5 lettres : en dessous, une
 * lettre d'ecart touche des mots courants (« prix » / « pris »).
 */
const FUZZY_TRIGGER_WORDS = [
  'album', 'albums', 'chanson', 'artiste', 'musicien', 'chanteur', 'chanteuse', 'concert',
  'dernier', 'derniere', 'nouveau', 'nouvelle', 'recent', 'recente', 'sortie', 'release',
  'actualite', 'actualites', 'annee', 'resultat', 'classement', 'election', 'president', 'ministre', 'score', 'match',
];

function withoutAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Distance d'edition (une substitution, insertion ou suppression = 1). */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

function hasFuzzyTrigger(msg: string): boolean {
  const words = withoutAccents(msg).match(/[a-z]{4,}/g) ?? [];
  return words.some((word) =>
    FUZZY_TRIGGER_WORDS.some(
      (target) => target.length >= 5 && Math.abs(target.length - word.length) <= 1 && editDistance(word, target) <= 1
    )
  );
}

function needsWebSearch(lastUserMessage: string, conversationHistory: ChatMessage[]): boolean {
  const msg = lastUserMessage.toLowerCase();
  if (msg.length > 500) return false;
  if (SEARCH_TRIGGERS.some(p => p.test(msg))) return true;
  if (hasFuzzyTrigger(msg)) return true;

  const recentTopics = conversationHistory.slice(-6).map(m => m.content.toLowerCase()).join(' ');
  if (recentTopics.includes('album') || recentTopics.includes('artiste') || recentTopics.includes('musique')) {
    if (msg.length < 100) return true;
  }

  return false;
}

function extractSearchQuery(lastUserMessage: string, conversationHistory: ChatMessage[]): string {
  let query = lastUserMessage
    .replace(/^(salut|bonjour|hey|hello|coucou|yo|cc|slt|bjr|bsr|mec|bro|wesh|ok|oui|non|ah|oh|hmm|merci|super|cool|nice|wow)[\s!?.]*/i, '')
    .replace(/^(tu peux |est-ce que tu |peux-tu |pourrais-tu |j'aimerais savoir |dis-moi |explique-moi |raconte-moi )/i, '')
    .trim();

  // Question de suite (« son dernier mandat ? ») : sans son sujet, la
  // recherche part sur n'importe quoi. Le sujet est repris de la question
  // precedente de l'utilisateur.
  if (isFollowUpQuestion(query)) {
    const subject = previousSubject(lastUserMessage, conversationHistory);
    if (subject && !withoutAccents(query.toLowerCase()).includes(withoutAccents(subject.toLowerCase()))) {
      query = `${subject} ${query}`.trim();
    }
  }

  if (query.length > 150) query = query.substring(0, 150);
  return query || lastUserMessage.substring(0, 100);
}

/** Renvoi a quelqu'un ou quelque chose deja cite, ou question trop courte pour etre autonome. */
const REFERENCE_WORDS =
  /\b(son|sa|ses|il|elle|ils|elles|lui|leur|leurs|celui-ci|celle-ci|ce dernier|cette derniere|his|her|their|he|she|they)\b/i;

/** Courte, ou courte avec un renvoi : une question longue porte son propre sujet. */
function isFollowUpQuestion(query: string): boolean {
  const words = searchKeywords(query).split(/\s+/).filter(Boolean).length;
  return words < 3 || (words < 5 && REFERENCE_WORDS.test(query));
}

/** Mots-cles de la question precedente de l'utilisateur (le sujet de la conversation). */
function previousSubject(lastUserMessage: string, conversationHistory: ChatMessage[]): string {
  const previous = [...conversationHistory]
    .reverse()
    .filter((m) => m.role === 'user' && m.content.trim() !== lastUserMessage.trim())
    .map((m) => searchKeywords(m.content))
    .find((keywords) => keywords.length > 0);
  return (previous ?? '').split(/\s+/).slice(0, 6).join(' ');
}

function estimateTokens(messages: ChatMessage[]): number {
  return messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0);
}

/**
 * Preparation commune a `chatFlow` et `chatFlowSync`.
 *
 * Assemble la system instruction : la voix injectee par l'appelant, puis les
 * fragments de session (prenom, canal). Injecte les resultats de recherche web
 * si le declencheur le demande, puis estime les tokens d'entree. Cette logique
 * appartient a la facade applicative : elle n'a rien a faire dans le noyau
 * GnoxeBrains.
 */
async function prepareChat(input: ChatFlowInput): Promise<{
  messages: ChatMessage[];
  model: string;
  inputTokens: number;
}> {
  let context = buildChatContext(
    input.messages,
    20,
    input.userName,
    input.channel,
    input.systemPrompt,
    {
      recallResolver: input.recallResolver,
      provenanceCheck: input.provenanceCheck,
      historyCoverage: input.historyCoverage,
      recallStoredHistory: input.recallStoredHistory,
      recallGuard: input.recallGuard,
    }
  );
  const model = input.model || DEFAULT_MODEL;

  const lastUserMsg = input.messages.filter((m) => m.role === 'user').pop();
  if (lastUserMsg && needsWebSearch(lastUserMsg.content, input.messages)) {
    const query = extractSearchQuery(lastUserMsg.content, input.messages);
    const results = await webSearch(query);
    if (results.length > 0) {
      const searchContext = buildSearchContext(query, results);
      context = [
        ...context.slice(0, -1),
        { role: 'user' as const, content: context[context.length - 1].content + searchContext },
      ];
    }
  }

  return { messages: context, model, inputTokens: estimateTokens(context) };
}

/**
 * Faade de compatibilite : streaming d'un tour de conversation.
 *
 * Elle delegue a `GnoxeBrains.answerStream()` (couche d'intelligence) et
 * recontracte l'evenementiel historique attendu par `apps/api`.
 * Le streaming est conserve au niveau du ModelProvider : il n'est pas
 * degrade en un simple `generate()`.
 */
export async function* chatFlow(
  input: ChatFlowInput
): AsyncIterable<{ type: 'text' | 'tool_call' | 'tool_result' | 'done'; content: string; model?: string; inputTokens?: number; outputTokens?: number }> {
  const { messages, model: requestedModel, inputTokens } = await prepareChat(input);

  let fullResponse = '';
  let effectiveModel = requestedModel;

  for await (const chunk of getGnoxeBrains().answerStream({ messages, model: requestedModel })) {
    if (chunk.type === 'text') {
      fullResponse += chunk.content;
      yield { type: 'text', content: chunk.content };
    } else if (chunk.type === 'done') {
      effectiveModel = chunk.model;
    }
  }

  yield {
    type: 'done',
    content: fullResponse,
    model: effectiveModel,
    inputTokens,
    outputTokens: Math.ceil(fullResponse.length / 4),
  };
}

/**
 * Faade de compatibilite : reponse complete d'un tour de conversation.
 *
 * Meme chemin que `chatFlow`, sans fragmentation. Le contrat de retour
 * (`ChatFlowOutput`) est strictement preserve.
 */
export async function chatFlowSync(input: ChatFlowInput): Promise<ChatFlowOutput> {
  const { messages, model: requestedModel, inputTokens } = await prepareChat(input);

  const { content, model: effectiveModel } = await getGnoxeBrains().answer({
    messages,
    model: requestedModel,
  });

  return {
    content,
    model: effectiveModel,
    inputTokens,
    outputTokens: Math.ceil(content.length / 4),
  };
}
