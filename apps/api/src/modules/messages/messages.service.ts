import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { prisma } from '../../lib/prisma';
import { MessageStatus, MessageRole } from '@prisma/client';

@Injectable()
export class MessagesService {
  async create(
    conversationId: string,
    role: MessageRole,
    content: string,
    options?: {
      model?: string;
      provider?: string;
      status?: MessageStatus;
    }
  ) {
    return prisma.message.create({
      data: {
        conversationId,
        role,
        content,
        model: options?.model,
        provider: options?.provider,
        status: options?.status || 'COMPLETED',
      },
    });
  }

  async createStreaming(
    conversationId: string,
    model?: string,
    provider?: string
  ) {
    return prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: '',
        model,
        provider,
        status: 'STREAMING',
      },
    });
  }

  async updateContent(id: string, content: string) {
    return prisma.message.update({
      where: { id },
      data: { content },
    });
  }

  async completeStreaming(
    id: string,
    content: string,
    options?: {
      inputTokens?: number;
      outputTokens?: number;
      latencyMs?: number;
    }
  ) {
    return prisma.message.update({
      where: { id },
      data: {
        content,
        status: 'COMPLETED',
        inputTokens: options?.inputTokens,
        outputTokens: options?.outputTokens,
        latencyMs: options?.latencyMs,
      },
    });
  }

  async failStreaming(id: string, content?: string) {
    return prisma.message.update({
      where: { id },
      data: {
        content: content || 'Une erreur est survenue lors de la generation.',
        status: 'FAILED',
      },
    });
  }

  async findByConversation(conversationId: string, userId?: string) {
    if (userId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { userId: true },
      });
      if (!conversation || conversation.userId !== userId) {
        throw new NotFoundException('Conversation non trouvee');
      }
    }
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        attachments: true,
        aiRequests: true,
      },
    });
  }

  async findById(id: string) {
    return prisma.message.findUnique({
      where: { id },
      include: { aiRequests: true },
    });
  }

  async updateTokens(id: string, inputTokens: number, outputTokens: number) {
    return prisma.message.update({
      where: { id },
      data: { inputTokens, outputTokens },
    });
  }

  async getStats(userId: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalMessages, messagesToday, totalTokens] = await Promise.all([
      prisma.message.count({
        where: {
          conversation: { userId },
        },
      }),
      prisma.message.count({
        where: {
          conversation: { userId },
          createdAt: { gte: today },
        },
      }),
      prisma.message.aggregate({
        where: {
          conversation: { userId },
        },
        _sum: {
          inputTokens: true,
          outputTokens: true,
        },
      }),
    ]);

    return {
      totalMessages,
      messagesToday,
      totalTokens: (totalTokens._sum.inputTokens || 0) + (totalTokens._sum.outputTokens || 0),
    };
  }
}
