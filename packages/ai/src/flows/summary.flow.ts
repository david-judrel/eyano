import { ChatMessage } from '@eyano/types';
import { getAIProvider } from '../providers';

export async function summaryFlow(messages: ChatMessage[]): Promise<string> {
  const provider = getAIProvider();

  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'EYANO'}: ${m.content}`)
    .join('\n\n');

  const summary = await provider.generate(
    [
      {
        role: 'user',
        content: `Résume cette conversation en 2-3 phrases maximum :\n\n${conversationText}`,
      },
    ],
    { model: 'gnoxe-brains-1', temperature: 0.3, maxTokens: 200 }
  );

  return summary.trim();
}
