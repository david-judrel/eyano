import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { AiModule } from './modules/ai/ai.module';
import { FilesModule } from './modules/files/files.module';
import { UsageModule } from './modules/usage/usage.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
    AiModule,
    FilesModule,
    UsageModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
