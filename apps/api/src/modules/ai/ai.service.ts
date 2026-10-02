import { Injectable } from '@nestjs/common';
import { prisma } from '../../lib/prisma';
import {
  chatFlow,
  chatFlowSync,
  titleFlow,
  getActiveProviderName,
  DEFAULT_MODEL_ID,
  DEFAULT_IMAGE_MODEL_ID,
} from '@eyano/gnoxe-brains';
import {
  runKeplerInChat,
  planKepler,
  keplerChatNote,
  historyContentForChat,
  KeplerChatAttachment,
  ChatMode,
} from '../image/kepler-chat';
import { buildEyanoContext } from '@eyano/eyano-identity';
import { ChatMessage, ImageAttachment } from '@eyano/types';
import { MessagesService } from '../messages/messages.service';
import { UsageService } from '../usage/usage.service';
import { AIRequestsService } from '../ai-requests/ai-requests.service';

const GENERIC_PATTERNS = /^(salut|bonjour|hello|hey|coucou|bonsoir|yo|cc|slt|bjr|bsr|merci|ok|oui|non|ah|oh|hmm|ahaha|lol|mdr)[\s!?.]*$/i;

@Injectable()
export class AiService {
  constructor(
    private messagesService: MessagesService,
    private usageService: UsageService,
    private aiRequestsService: AIRequestsService
  ) {}

  private findFirstMeaningfulMessage(messages: ChatMessage[]): string | null {
    for (const m of messages) {
      if (m.role === 'user' && !GENERIC_PATTERNS.test(m.content.trim()) && m.content.trim().length >= 5) {
        return m.content;
      }
    }
    return null;
  }

  async chat(
    userId: string,
    conversationId: string,
    content: string,
    model?: string,
    images?: ImageAttachment[],
    mode?: ChatMode
  ): Promise<{ response: string; messageId: string; title: string | null; attachments?: KeplerChatAttachment[] }> {
    const providerName = getActiveProviderName();

    // IDOR Protection: Verify conversation belongs to user
    const ownershipCheck = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });

    if (!ownershipCheck || ownershipCheck.userId !== userId) {
      throw new Error('Conversation non trouvee');
    }

    const [history, user] = await Promise.all([
      this.messagesService.findByConversation(conversationId),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);

    const keplerPlan = planKepler(content, history, mode);

    const messages: ChatMessage[] = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: historyContentForChat(m) })),
      { role: 'user', content, images: images && images.length > 0 ? images : undefined },
    ];

    const userMessage = await this.messagesService.create(conversationId, 'user', content, {
      model,
      provider: providerName,
    });

    // Kepler Image (experimental) : une demande d'image ne passe pas par le
    // modele de conversation. Drapeau coupe : chemin inchange.
    if (keplerPlan) {
      const startedAt = Date.now();
      const assistant = await this.messagesService.createStreaming(conversationId, DEFAULT_IMAGE_MODEL_ID, providerName);
      const outcome = await runKeplerInChat(keplerPlan.prompt, assistant.id);
      await this.messagesService.completeStreaming(assistant.id, outcome.text, { latencyMs: Date.now() - startedAt });
      const keplerTitle = await this.resolveTitle(conversationId, messages);
      return {
        response: outcome.text,
        messageId: assistant.id,
        title: keplerTitle,
        attachments: outcome.attachment ? [outcome.attachment] : [],
      };
    }

    const startTime = Date.now();
    const result = await chatFlowSync({
      userId,
      conversationId,
      messages,
      model,
      userName: user?.name || undefined,
      systemPrompt: buildEyanoContext() + keplerChatNote(),
    });

    const latencyMs = Date.now() - startTime;

    const assistantMessage = await this.messagesService.create(conversationId, 'assistant', result.content, {
      model: result.model,
      provider: providerName,
    });

    await this.aiRequestsService.create({
      messageId: assistantMessage.id,
      provider: providerName,
      model: result.model,
    });

    await this.messagesService.updateTokens(assistantMessage.id, result.inputTokens, result.outputTokens);
    await this.usageService.track(userId, result.model, result.inputTokens, result.outputTokens);

    const title = await this.resolveTitle(conversationId, messages);

    return { response: result.content, messageId: assistantMessage.id, title };
  }

  /** Titre de la conversation : existant, ou genere a la premiere demande utile. */
  private async resolveTitle(conversationId: string, messages: ChatMessage[]): Promise<string | null> {
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    let title: string | null = null;
    if (conversation && !conversation.title) {
      const meaningful = this.findFirstMeaningfulMessage(messages);
      if (meaningful) {
        try {
          title = await titleFlow(meaningful);
          await prisma.conversation.update({ where: { id: conversationId }, data: { title } });
        } catch {}
      }
    } else if (conversation?.title) {
      title = conversation.title;
    }
    return title;
  }

  async *chatStream(
    userId: string,
    conversationId: string,
    content: string,
    model?: string,
    images?: ImageAttachment[],
    mode?: ChatMode
  ) {
    const providerName = getActiveProviderName();

    // IDOR Protection: Verify conversation belongs to user
    const ownershipCheck = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });

    if (!ownershipCheck || ownershipCheck.userId !== userId) {
      yield { type: 'error' as const, code: 'CONVERSATION_NOT_FOUND', message: 'Conversation non trouvee' };
      return;
    }

    const [history, user] = await Promise.all([
      this.messagesService.findByConversation(conversationId),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);

    const keplerPlan = planKepler(content, history, mode);

    const messages: ChatMessage[] = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: historyContentForChat(m) })),
      { role: 'user', content, images: images && images.length > 0 ? images : undefined },
    ];

    const userMessage = await this.messagesService.create(conversationId, 'user', content, {
      model,
      provider: providerName,
    });

    yield { type: 'start' as const, messageId: userMessage.id };

    const assistantMessage = await this.messagesService.createStreaming(conversationId, model, providerName);

    yield { type: 'message_created' as const, messageId: assistantMessage.id };

    // Kepler Image (experimental) : l'image arrive dans le fil, apres le texte
    // d'Eyano, par l'evenement `image`. Drapeau coupe : chemin inchange.
    if (keplerPlan) {
      const startedAt = Date.now();
      try {
        yield { type: 'image_pending' as const };
        const outcome = await runKeplerInChat(keplerPlan.prompt, assistantMessage.id);
        yield { type: 'text' as const, content: outcome.text };
        if (outcome.attachment) {
          yield { type: 'image' as const, attachment: outcome.attachment };
        }
        await this.messagesService.completeStreaming(assistantMessage.id, outcome.text, {
          latencyMs: Date.now() - startedAt,
        });
        const keplerTitle = await this.resolveTitle(conversationId, messages);
        yield {
          type: 'done' as const,
          messageId: assistantMessage.id,
          title: keplerTitle,
          inputTokens: 0,
          outputTokens: 0,
        };
      } catch {
        await this.messagesService.failStreaming(assistantMessage.id);
        yield {
          type: 'error' as const,
          code: 'IMAGE_GENERATION_ERROR',
          message: "La génération de l'image a échoué.",
        };
      }
      return;
    }

    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;
    const startTime = Date.now();

    let aiRequestId: string | null = null;

    try {
      const stream = chatFlow({
        userId,
        conversationId,
        messages,
        model,
        userName: user?.name || undefined,
        systemPrompt: buildEyanoContext() + keplerChatNote(),
      });

      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          fullResponse += chunk.content;
          yield { type: 'text' as const, content: chunk.content };
        } else if (chunk.type === 'done') {
          inputTokens = chunk.inputTokens || 0;
          outputTokens = chunk.outputTokens || 0;

          const latencyMs = Date.now() - startTime;

          await this.messagesService.completeStreaming(assistantMessage.id, fullResponse, {
            inputTokens,
            outputTokens,
            latencyMs,
          });

          const aiRequest = await this.aiRequestsService.create({
            messageId: assistantMessage.id,
            provider: providerName,
            model: chunk.model || model || DEFAULT_MODEL_ID,
          });
          aiRequestId = aiRequest.id;

          await this.aiRequestsService.complete(aiRequest.id, {
            inputTokens,
            outputTokens,
            latencyMs,
            status: 'SUCCESS',
          });

          await this.usageService.track(userId, chunk.model || model || DEFAULT_MODEL_ID, inputTokens, outputTokens);
        }
      }

      const title = await this.resolveTitle(conversationId, messages);

      yield {
        type: 'done' as const,
        messageId: assistantMessage.id,
        title,
        inputTokens,
        outputTokens,
      };
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;

      await this.messagesService.failStreaming(assistantMessage.id);

      if (aiRequestId) {
        await this.aiRequestsService.complete(aiRequestId, {
          latencyMs,
          status: 'FAILED',
          errorCode: error?.code || 'UNKNOWN',
          errorMessage: error?.message || 'Une erreur est survenue',
        });
      }

      yield {
        type: 'error' as const,
        code: 'AI_PROVIDER_ERROR',
        message: 'Le service IA est temporairement indisponible.',
      };
    }
  }
}
