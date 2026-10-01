import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { isRegisteredModel } from '@eyano/gnoxe-brains';
import type { ChatMessage } from '@eyano/types';
import { AuthGuard } from '../../guards/auth.guard';
import { AdminGuard } from '../../guards/admin.guard';
import { RateLimitGuard } from '../../guards/rate-limit.guard';
import { AuditService } from '../audit/audit.service';
import { MissionsService, MissionExecutionError } from './missions.service';

/** Un tour d'historique : role dialogue, contenu textuel. */
class MissionMessageDto {
  role!: 'user' | 'assistant';
  content!: string;
}

class RunMissionDto {
  objective!: string;
  model?: string;
  /** Historique conversationnel (matiere utilisateur, borne en aval). */
  messages?: MissionMessageDto[];
}

/** Bornes appliquees avant d'atteindre la couche d'intelligence. */
const MAX_OBJECTIVE_LENGTH = 4000;

@ApiTags('missions')
@Controller('missions')
@UseGuards(AuthGuard, AdminGuard, RateLimitGuard)
@ApiBearerAuth()
export class MissionsController {
  constructor(
    private readonly missionsService: MissionsService,
    private readonly auditService: AuditService
  ) {}

  @Post('run')
  @ApiOperation({ summary: 'Executer une mission multi-agents (admin)' })
  async run(@Body() body: RunMissionDto, @Req() req: any) {
    const objective = typeof body?.objective === 'string' ? body.objective.trim() : '';
    if (!objective) {
      throw new BadRequestException('Un objectif non vide est requis.');
    }
    if (objective.length > MAX_OBJECTIVE_LENGTH) {
      throw new BadRequestException(
        `Objectif trop long (${MAX_OBJECTIVE_LENGTH} caracteres maximum).`
      );
    }
    if (body.model && !isRegisteredModel(body.model)) {
      throw new BadRequestException(`Modele IA inconnu : ${body.model}`);
    }
    const messages = this.normalizeMessages(body?.messages);

    try {
      const trace = await this.missionsService.run(
        { objective, model: body.model, messages },
        req.user.userId
      );

      await this.auditService.log({
        userId: req.user.userId,
        action: 'RUN_MISSION',
        target: trace.missionId,
        details: {
          status: trace.status,
          durationMs: trace.durationMs,
          steps: trace.plan.length,
        },
        ip: req.ip,
      });

      return trace;
    } catch (error) {
      const missionId =
        error instanceof MissionExecutionError && error.missionId ? error.missionId : undefined;

      await this.auditService.log({
        userId: req.user.userId,
        action: 'RUN_MISSION',
        target: missionId,
        details: { status: 'FAILED' },
        ip: req.ip,
      });

      if (error instanceof MissionExecutionError) {
        throw new InternalServerErrorException(`Mission echouee : ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Valide l'historique avant transmission a la couche d'intelligence.
   *
   * Seuls les roles de dialogue sont acceptes : aucun role systeme ne peut
   * entrer par cette porte. Le volume n'est pas borne ici : la politique
   * unique `maxContextMessages` s'applique en aval, dans la facade.
   */
  private normalizeMessages(raw?: MissionMessageDto[]): ChatMessage[] | undefined {
    if (raw === undefined) return undefined;
    if (!Array.isArray(raw)) {
      throw new BadRequestException('Historique de conversation invalide.');
    }
    if (raw.length === 0) return undefined;

    return raw.map((entry, index) => {
      if (!entry || (entry.role !== 'user' && entry.role !== 'assistant')) {
        throw new BadRequestException(`Role de message invalide (position ${index}).`);
      }
      if (typeof entry.content !== 'string') {
        throw new BadRequestException(`Contenu de message invalide (position ${index}).`);
      }
      return { role: entry.role, content: entry.content };
    });
  }
}
