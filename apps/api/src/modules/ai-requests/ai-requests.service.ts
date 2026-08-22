import { Injectable } from '@nestjs/common';
import { prisma } from '../../lib/prisma';
import { AIRequestStatus } from '@prisma/client';

@Injectable()
export class AIRequestsService {
  async create(data: {
    messageId: string;
    provider: string;
    model: string;
    keyId?: string;
  }) {
    return prisma.aIRequest.create({
      data: {
        messageId: data.messageId,
        provider: data.provider,
        model: data.model,
        keyId: data.keyId,
        status: 'PENDING',
      },
    });
  }

  async complete(
    id: string,
    data: {
      inputTokens?: number;
      outputTokens?: number;
      latencyMs?: number;
      status: AIRequestStatus;
      errorCode?: string;
      errorMessage?: string;
    }
  ) {
    return prisma.aIRequest.update({
      where: { id },
      data: {
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        latencyMs: data.latencyMs,
        status: data.status,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
      },
    });
  }

  async findByMessage(messageId: string) {
    return prisma.aIRequest.findMany({
      where: { messageId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(params?: { startDate?: Date; endDate?: Date }) {
    const where: any = {};
    if (params?.startDate || params?.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [total, successful, failed, rateLimited, byProvider, byModel] = await Promise.all([
      prisma.aIRequest.count({ where }),
      prisma.aIRequest.count({ where: { ...where, status: 'SUCCESS' } }),
      prisma.aIRequest.count({ where: { ...where, status: 'FAILED' } }),
      prisma.aIRequest.count({ where: { ...where, status: 'RATE_LIMITED' } }),
      prisma.aIRequest.groupBy({
        by: ['provider'],
        _count: { provider: true },
        _sum: { inputTokens: true, outputTokens: true },
        where,
      }),
      prisma.aIRequest.groupBy({
        by: ['model'],
        _count: { model: true },
        _sum: { inputTokens: true, outputTokens: true },
        where,
      }),
    ]);

    return {
      total,
      successful,
      failed,
      rateLimited,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        count: p._count.provider,
        inputTokens: p._sum.inputTokens || 0,
        outputTokens: p._sum.outputTokens || 0,
      })),
      byModel: byModel.map((m) => ({
        model: m.model,
        count: m._count.model,
        inputTokens: m._sum.inputTokens || 0,
        outputTokens: m._sum.outputTokens || 0,
      })),
    };
  }
}
