import { getAIProvider } from '../providers';

export async function documentAnalysisFlow(
  documentContent: string,
  question: string
): Promise<string> {
  const provider = getAIProvider();

  const response = await provider.generate(
    [
      {
        role: 'user',
        content: `Voici le contenu d'un document :\n\n---\n${documentContent}\n---\n\nQuestion : ${question}`,
      },
    ],
    { model: 'gnoxe-brains-1.5', temperature: 0.5, maxTokens: 4096 }
  );

  return response;
}
