import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { prisma } from '../../lib/prisma';

@Injectable()
export class ConversationsService {
  async create(userId: string, data?: { title?: string; model?: string; provider?: string }) {
    return prisma.conversation.create({
      data: {
        userId,
        title: data?.title,
        model: data?.model,
        provider: data?.provider,
      },
    });
  }

  async findAll(userId: string, params?: { limit?: number; offset?: number }) {
    const limit = params?.limit || 50;
    const offset = params?.offset || 0;

    return prisma.conversation.findMany({
      where: { userId, archived: false },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
      take: limit,
      skip: offset,
    });
  }

  async findOne(id: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            attachments: true,
            aiRequests: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation non trouvee');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Acces interdit');
    }

    return conversation;
  }

  async update(id: string, userId: string, data: { title?: string; model?: string; provider?: string; archived?: boolean }) {
    const conversation = await prisma.conversation.findUnique({ where: { id } });

    if (!conversation) {
      throw new NotFoundException('Conversation non trouvee');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Acces interdit');
    }

    return prisma.conversation.update({
      where: { id },
      data,
    });
  }

  async updateTitle(id: string, userId: string, title: string) {
    return this.update(id, userId, { title });
  }

  async remove(id: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({ where: { id } });

    if (!conversation) {
      throw new NotFoundException('Conversation non trouvee');
    }

    if (conversation.userId !== userId) {
      throw new ForbiddenException('Acces interdit');
    }

    return prisma.conversation.delete({ where: { id } });
  }

  async getStats(userId: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalConversations, conversationsToday] = await Promise.all([
      prisma.conversation.count({
        where: { userId },
      }),
      prisma.conversation.count({
        where: {
          userId,
          createdAt: { gte: today },
        },
      }),
    ]);

    return {
      totalConversations,
      conversationsToday,
    };
  }
}
