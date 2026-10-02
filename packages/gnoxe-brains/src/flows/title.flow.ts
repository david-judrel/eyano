import { getGnoxeBrains } from '../core/singleton';
import { buildTitlePrompt } from '../prompts/eyano.system';
import { getDefaultModel } from '../models';

const GENERIC_PATTERNS = /^(salut|bonjour|hello|hey|coucou|bonsoir|yo|cc|slt|bjr|bsr)[\s!?.]*$/i;

/**
 * Faade de compatibilite : generation de titre de conversation.
 *
 * Cas d'usage different du pipeline complet (recherche / analyse /
 * verification / redaction) : il ne serait ni juste ni efficace d'y passer
 * les quatre agents. Le titre profite simplement de la couche GnoxeBrains
 * (`answer()`) pour resoudre le modele, avec sa signature et son
 * comportement inchanges (court-circuit des salutations, decoupe a 100).
 */
export async function titleFlow(firstMessage: string): Promise<string> {
  if (GENERIC_PATTERNS.test(firstMessage.trim()) || firstMessage.trim().length < 5) {
    return 'Nouvelle conversation';
  }

  const prompt = buildTitlePrompt(firstMessage);

  const { content } = await getGnoxeBrains().answer({
    messages: [{ role: 'user', content: prompt }],
    model: getDefaultModel(),
    temperature: 0.3,
    maxTokens: 50,
  });

  return content.trim().substring(0, 100);
}
