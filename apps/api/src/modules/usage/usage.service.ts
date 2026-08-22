import { Injectable } from '@nestjs/common';
import { prisma } from '../../lib/prisma';

interface ModelPricing {
  input: number;  // cost per 1M tokens
  output: number; // cost per 1M tokens
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'gemini-3.5-flash-lite': { input: 0.015, output: 0.06 },
  'gemini-3.6-flash': { input: 0.03, output: 0.12 },
  'gemini-2.0-flash': { input: 0.075, output: 0.3 },
  'gnoxe-brains-1': { input: 0.015, output: 0.06 },
  'gnoxe-brains-1.5': { input: 0.03, output: 0.12 },
};

@Injectable()
export class UsageService {
  async track(userId: string, model: string, inputTokens: number, outputTokens: number) {
    return prisma.usage.create({
      data: { userId, model, inputTokens, outputTokens },
    });
  }

  async getUsage(userId: string) {
    const usages = await prisma.usage.findMany({
      where: { userId },
    });

    return this.aggregateUsage(usages);
  }

  async getUsageByPeriod(userId: string, period: 'today' | 'month' | 'all') {
    const now = new Date();
    let startDate: Date | undefined;

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const usages = await prisma.usage.findMany({
      where: {
        userId,
        ...(startDate && { createdAt: { gte: startDate } }),
      },
    });

    return this.aggregateUsage(usages);
  }

  async getGlobalStats() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayUsages, monthUsages, totalUsages] = await Promise.all([
      prisma.usage.findMany({ where: { createdAt: { gte: todayStart } } }),
      prisma.usage.findMany({ where: { createdAt: { gte: monthStart } } }),
      prisma.usage.findMany(),
    ]);

    return {
      today: this.aggregateUsage(todayUsages),
      month: this.aggregateUsage(monthUsages),
      total: this.aggregateUsage(totalUsages),
    };
  }

  private aggregateUsage(usages: any[]) {
    const totalInputTokens = usages.reduce((acc, u) => acc + u.inputTokens, 0);
    const totalOutputTokens = usages.reduce((acc, u) => acc + u.outputTokens, 0);
    const totalTokens = totalInputTokens + totalOutputTokens;

    const byModel: Record<string, {
      inputTokens: number;
      outputTokens: number;
      requests: number;
      cost: number;
    }> = {};

    for (const usage of usages) {
      if (!byModel[usage.model]) {
        byModel[usage.model] = { inputTokens: 0, outputTokens: 0, requests: 0, cost: 0 };
      }
      byModel[usage.model].inputTokens += usage.inputTokens;
      byModel[usage.model].outputTokens += usage.outputTokens;
      byModel[usage.model].requests++;
      byModel[usage.model].cost += this.calculateCost(usage.model, usage.inputTokens, usage.outputTokens);
    }

    const totalCost = Object.values(byModel).reduce((acc, m) => acc + m.cost, 0);

    return {
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalRequests: usages.length,
      totalCost,
      byModel,
    };
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] || { input: 0.015, output: 0.06 };
    return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  }
}
