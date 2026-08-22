import { Injectable } from '@nestjs/common';
import { prisma } from '../../lib/prisma';

export interface LogAction {
  userId: string;
  action: string;
  target?: string;
  details?: Record<string, any>;
  ip?: string;
}

@Injectable()
export class AuditService {
  async log(data: LogAction): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          target: data.target,
          details: data.details || undefined,
          ip: data.ip,
        },
      });
    } catch (error) {
      console.error('[AuditService] Failed to log action:', error);
    }
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { page = 1, limit = 50, userId, action, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalToday, totalWeek, totalAll, topActions] = await Promise.all([
      prisma.auditLog.count({
        where: { createdAt: { gte: today } },
      }),
      prisma.auditLog.count({
        where: { createdAt: { gte: thisWeek } },
      }),
      prisma.auditLog.count(),
      prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      totalToday,
      totalWeek,
      totalAll,
      topActions: topActions.map((a) => ({
        action: a.action,
        count: a._count.action,
      })),
    };
  }
}
