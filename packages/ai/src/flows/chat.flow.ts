import { ChatMessage } from '@eyano/types';
import { getAIProvider } from '../providers';
import { buildChatContext } from '../prompts/eyano.system';
import { getToolByName } from '../tools';

export interface ChatFlowInput {
  userId: string;
  conversationId: string;
  messages: ChatMessage[];
  model?: string;
  userName?: string;
  channel?: string;
}

export interface ChatFlowOutput {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function* chatFlow(
  input: ChatFlowInput
): AsyncIterable<{ type: 'text' | 'tool_call' | 'tool_result' | 'done'; content: string; model?: string; inputTokens?: number; outputTokens?: number }> {
  const provider = getAIProvider();
  const context = buildChatContext(input.messages, 20, input.userName, input.channel);
  const model = input.model || 'gnoxe-brains-1';

  let fullResponse = '';

  const stream = provider.stream(context, { model });

  for await (const chunk of stream) {
    fullResponse += chunk;
    yield { type: 'text', content: chunk };
  }

  yield {
    type: 'done',
    content: fullResponse,
    model,
    inputTokens: context.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0),
    outputTokens: Math.ceil(fullResponse.length / 4),
  };
}

export async function chatFlowSync(input: ChatFlowInput): Promise<ChatFlowOutput> {
  const provider = getAIProvider();
  const context = buildChatContext(input.messages, 20, input.userName, input.channel);
  const model = input.model || 'gnoxe-brains-1';

  const response = await provider.generate(context, { model });

  return {
    content: response,
    model,
    inputTokens: context.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0),
    outputTokens: Math.ceil(response.length / 4),
  };
}
