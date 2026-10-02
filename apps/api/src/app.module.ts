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
import { MissionsModule } from './modules/missions/missions.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { ImageModule } from './modules/image/image.module';
import { isKeplerImageEnabled } from './modules/image/kepler-flag';

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
    MissionsModule,
    WhatsAppModule,
    // Kepler Image (experimental) : absent tant que le drapeau est coupe.
    // Evalue APRES `ConfigModule.forRoot()` ci-dessus, qui a deja charge le
    // `.env` dans `process.env`.
    ...(isKeplerImageEnabled() ? [ImageModule] : []),
  ],
  controllers: [HealthController],
})
export class AppModule {}
