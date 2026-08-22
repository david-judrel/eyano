import { Module } from '@nestjs/common';
import { AIRequestsService } from './ai-requests.service';

@Module({
  providers: [AIRequestsService],
  exports: [AIRequestsService],
})
export class AIRequestsModule {}
