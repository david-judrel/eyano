import { Controller, Get, Post, Body, UseGuards, Req, Res, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AiService } from './ai.service';
import { isKeplerImageEnabled } from '../image/kepler-flag';
import { AuthGuard } from '../../guards/auth.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';
import { AuditService } from '../audit/audit.service';
import { getProviderKeyMetrics, resetProviderKeys, isRegisteredModel } from '@eyano/gnoxe-brains';

class ImageDto {
  mimeType!: string;
  data!: string;
}

class ChatDto {
  conversationId!: string;
  message!: string;
  model?: string;
  images?: ImageDto[];
  /** `image` : « Créer une image » choisi dans l'interface (Kepler). */
  mode?: 'image';
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
  @ApiOperation({ summary: 'Metriques et etat des cles du fournisseur (admin)' })
  async getKeysStatus(@Req() req: any) {
    await this.auditService.log({
      userId: req.user.userId,
      action: 'VIEW_PROVIDER_KEY_STATUS',
      target: 'provider-key-pool',
      ip: req.ip,
    });

    return getProviderKeyMetrics();
  }

  @Post('keys/reset')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Reinitialiser toutes les cles du fournisseur (admin)' })
  async resetKeys(@Req() req: any) {
    await this.auditService.log({
      userId: req.user.userId,
      action: 'RESET_PROVIDER_KEYS',
      target: 'provider-key-pool',
      ip: req.ip,
    });

    resetProviderKeys();
    return { message: 'Toutes les cles ont ete reinitialisees' };
  }

  /**
   * Refuse explicitement un modele inconnu plutot que de laisser la couche
   * d'intelligence servir silencieusement un autre modele (telemetrie fausse).
   */
  private assertKnownModel(model?: string): void {
    if (model && !isRegisteredModel(model)) {
      throw new BadRequestException(`Modele IA inconnu : ${model}`);
    }
  }

  /** Seule valeur reconnue : `image`. Toute autre valeur est ignoree. */
  private modeOf(body: ChatDto): 'image' | undefined {
    return body.mode === 'image' ? 'image' : undefined;
  }

  /** Ce que l'interface peut proposer (bouton « Créer une image »). */
  @Get('capabilities')
  @ApiOperation({ summary: "Capacites disponibles pour l'interface" })
  getCapabilities() {
    return { imageGeneration: isKeplerImageEnabled() };
  }

  @Post('chat')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Envoyer un message et recevoir une reponse' })
  async chat(@Req() req: any, @Body() body: ChatDto) {
    this.assertKnownModel(body.model);
    return this.aiService.chat(req.user.userId, body.conversationId, body.message, body.model, body.images, this.modeOf(body));
  }

  @Post('chat/stream')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Envoyer un message avec streaming' })
  async chatStream(@Req() req: any, @Body() body: ChatDto, @Res() res: Response) {
    this.assertKnownModel(body.model);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const stream = this.aiService.chatStream(
        req.user.userId,
        body.conversationId,
        body.message,
        body.model,
        body.images,
        this.modeOf(body)
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
    this.assertKnownModel(body.model);

    const { prisma } = await import('@eyano/database');

    const conversation = await prisma.conversation.findUnique({
      where: { id: body.conversationId },
      select: { userId: true },
    });
    if (!conversation || conversation.userId !== req.user.userId) {
      throw new NotFoundException('Conversation non trouvee');
    }

    const lastUserMessage = await prisma.message.findFirst({
      where: {
        conversationId: body.conversationId,
        role: 'user',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastUserMessage) {
      throw new NotFoundException('Aucun message utilisateur trouve');
    }

    return this.aiService.chat(
      req.user.userId,
      body.conversationId,
      lastUserMessage.content,
      body.model
    );
  }
}
