import { ChatMessage } from '@eyano/types';
import { getGnoxeBrains } from '../core/singleton';
import { buildChatContext } from '../prompts/eyano.system';
import { HistoryCoverage } from '../recall/history-coverage';
import { webSearch, buildSearchContext } from '../tools/web-search.tool';
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
  /** Voir `ChatContextOptions.recallGuard` : controle experimental. */
  recallGuard?: boolean | 'conditional';
}

export interface ChatFlowOutput {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const DEFAULT_MODEL = getDefaultModel();

const SEARCH_TRIGGERS = [
  /album/i, /chanson/i, /artiste/i, /musicien/i, /concert/i,
  /dernier/i, /derniere/i, /nouveau/i, /nouvelle/i, /recent/i,
  /sorti/i, /release/i, /actualit/i, /news/i,
  /prix/i, /cout/i, /tarif/i, /combien/i,
  /date/i, /quand/i, /annee/i,
  /qui est/i, /c'est qui/i, /connais/i, /savoir/i,
  /alternatif/i, /compar/i, /meilleur/i,
  /installer/i, /configurer/i, /creer/i,
  /tutorial/i, /comment/i,
  /probleme/i, /erreur/i, /bug/i, /fix/i,
  /actualit/i, /info/i, /nouvelle/i,
  /202[4-9]/i, /203[0-9]/i,
];

function needsWebSearch(lastUserMessage: string, conversationHistory: ChatMessage[]): boolean {
  const msg = lastUserMessage.toLowerCase();
  if (msg.length > 500) return false;
  if (SEARCH_TRIGGERS.some(p => p.test(msg))) return true;

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

  if (query.length < 5) {
    const recentContext = conversationHistory.slice(-4).map(m => m.content).join(' ');
    const contextWords = recentContext.split(/\s+/).slice(-10).join(' ');
    query = `${contextWords} ${query}`.trim();
  }

  if (query.length > 150) query = query.substring(0, 150);
  return query || lastUserMessage.substring(0, 100);
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
