import { Module } from '@nestjs/common';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { AuditModule } from '../audit/audit.module';

/**
 * Cas d'usage pilote du pipeline multi-agents.
 *
 * Module isole : il ne touche ni au chemin de conversation (qui reste sur
 * la reponse courte de la facade), ni aux modules `ai`, `conversations` ou
 * `messages`. Aucune persistance : une execution = une mission en memoire.
 */
@Module({
  imports: [AuditModule],
  controllers: [MissionsController],
  providers: [MissionsService],
})
export class MissionsModule {}
