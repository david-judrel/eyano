import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { UsageModule } from '../usage/usage.module';
import { AuditModule } from '../audit/audit.module';
import { AIRequestsModule } from '../ai-requests/ai-requests.module';

@Module({
  imports: [MessagesModule, ConversationsModule, UsageModule, AuditModule, AIRequestsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
