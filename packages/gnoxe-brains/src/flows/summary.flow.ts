import { ChatMessage } from '@eyano/types';
import { getGnoxeBrains } from '../core/singleton';
import { getDefaultModel } from '../models';

/**
 * Symbole de compatibilite, conserve a l'identique (signature et retour).
 *
 * @deprecated Sans consommateur dans le monorepo. Implementation deleguee
 * a `GnoxeBrains.answer()` depuis l'etape 9 : le flow ne depend plus de
 * `getAIProvider()` et passe par la meme abstraction que les autres flows.
 */
export async function summaryFlow(messages: ChatMessage[]): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'EYANO'}: ${m.content}`)
    .join('\n\n');

  const { content } = await getGnoxeBrains().answer({
    messages: [
      {
        role: 'user',
        content: `Résume cette conversation en 2-3 phrases maximum :\n\n${conversationText}`,
      },
    ],
    model: getDefaultModel(),
    temperature: 0.3,
    maxTokens: 200,
  });

  return content.trim();
}
