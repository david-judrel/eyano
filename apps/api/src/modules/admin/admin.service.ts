import { Injectable } from '@nestjs/common';
import { prisma } from '../../lib/prisma';
import { UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
    status?: UserStatus;
  }) {
    const { page = 1, limit = 20, search, role, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status) where.status = status;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          _count: {
            select: {
              conversations: true,
              usage: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async updateUserRole(userId: string, role: UserRole) {
    return prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    return prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });
  }

  async getDashboardStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersWeek,
      totalConversations,
      conversationsToday,
      totalMessages,
      messagesToday,
      usersByRole,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: thisWeek } } }),
      prisma.conversation.count(),
      prisma.conversation.count({ where: { createdAt: { gte: today } } }),
      prisma.message.count(),
      prisma.message.count({ where: { createdAt: { gte: today } } }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersWeek,
        byRole: usersByRole.map((r) => ({ role: r.role, count: r._count.role })),
      },
      conversations: {
        total: totalConversations,
        today: conversationsToday,
      },
      messages: {
        total: totalMessages,
        today: messagesToday,
      },
    };
  }
}
