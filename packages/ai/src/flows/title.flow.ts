import { getAIProvider } from '../providers';
import { buildTitlePrompt } from '../prompts/eyano.system';

const GENERIC_PATTERNS = /^(salut|bonjour|hello|hey|coucou|bonsoir|yo|cc|slt|bjr|bsr)[\s!?.]*$/i;

export async function titleFlow(firstMessage: string): Promise<string> {
  if (GENERIC_PATTERNS.test(firstMessage.trim()) || firstMessage.trim().length < 5) {
    return 'Nouvelle conversation';
  }

  const provider = getAIProvider();
  const prompt = buildTitlePrompt(firstMessage);

  const title = await provider.generate(
    [{ role: 'user', content: prompt }],
    { model: 'gnoxe-brains-1', temperature: 0.3, maxTokens: 50 }
  );

  return title.trim().substring(0, 100);
}
