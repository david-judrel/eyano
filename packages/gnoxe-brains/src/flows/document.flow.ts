import { getGnoxeBrains } from '../core/singleton';

/**
 * Symbole de compatibilite, conserve a l'identique (signature et retour).
 *
 * @deprecated Sans consommateur dans le monorepo. Implementation deleguee
 * a `GnoxeBrains.answer()` depuis l'etape 9 : le flow ne depend plus de
 * `getAIProvider()` et passe par la meme abstraction que les autres flows.
 */
export async function documentAnalysisFlow(
  documentContent: string,
  question: string
): Promise<string> {
  const { content } = await getGnoxeBrains().answer({
    messages: [
      {
        role: 'user',
        content: `Voici le contenu d'un document :\n\n---\n${documentContent}\n---\n\nQuestion : ${question}`,
      },
    ],
    model: 'gnoxe-brains-1.5',
    temperature: 0.5,
    maxTokens: 4096,
  });

  return content;
}
