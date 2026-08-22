import { Controller, Get } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('health')
export class HealthController {
  @Get()
  async check() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'connected',
      };
    } catch {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'disconnected',
      };
    }
  }
}
