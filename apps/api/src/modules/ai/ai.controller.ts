import { Controller, Get, Post, Body, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AiService } from './ai.service';
import { AuthGuard } from '../../guards/auth.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';
import { AuditService } from '../audit/audit.service';
import { getKeyManager } from '@eyano/ai';

class ImageDto {
  mimeType!: string;
  data!: string;
}

class ChatDto {
  conversationId!: string;
  message!: string;
  model?: string;
  images?: ImageDto[];
}

class RegenerateDto {
  conversationId!: string;
  model?: string;
}

@ApiTags('ai')
@Controller('ai')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly auditService: AuditService
  ) {}

  @Get('keys/status')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Metriques et etat des cles Gemini (admin)' })
  async getKeysStatus(@Req() req: any) {
    await this.auditService.log({
      userId: req.user.userId,
      action: 'VIEW_GEMINI_KEYS_STATUS',
      target: 'gemini-key-pool',
      ip: req.ip,
    });

    const keyManager = getKeyManager();
    return keyManager.getMetrics();
  }

  @Post('keys/reset')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Reinitialiser toutes les cles Gemini (admin)' })
  async resetKeys(@Req() req: any) {
    await this.auditService.log({
      userId: req.user.userId,
      action: 'RESET_GEMINI_KEYS',
      target: 'gemini-key-pool',
      ip: req.ip,
    });

    const keyManager = getKeyManager();
    keyManager.resetAllKeys();
    return { message: 'Toutes les cles ont ete reinitialisees' };
  }

  @Post('chat')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Envoyer un message et recevoir une reponse' })
  async chat(@Req() req: any, @Body() body: ChatDto) {
    return this.aiService.chat(req.user.userId, body.conversationId, body.message, body.model, body.images);
  }

  @Post('chat/stream')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Envoyer un message avec streaming' })
  async chatStream(@Req() req: any, @Body() body: ChatDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const stream = this.aiService.chatStream(
        req.user.userId,
        body.conversationId,
        body.message,
        body.model,
        body.images
      );

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.write('data: [DONE]\n\n');
    } catch (error: any) {
      console.error('[AI] Stream error:', error?.message || error);
      res.write(`data: ${JSON.stringify({ type: 'error', content: 'Erreur lors de la generation' })}\n\n`);
    }

    res.end();
  }

  @Post('regenerate')
  @ApiOperation({ summary: 'Regenerer la derniere reponse' })
  async regenerate(@Req() req: any, @Body() body: RegenerateDto) {
    const { prisma } = await import('@eyano/database');
    const lastUserMessage = await prisma.message.findFirst({
      where: {
        conversationId: body.conversationId,
        role: 'user',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastUserMessage) {
      throw new Error('Aucun message utilisateur trouve');
    }

    return this.aiService.chat(
      req.user.userId,
      body.conversationId,
      lastUserMessage.content,
      body.model
    );
  }
}
