import { Controller, Get, Post, Body, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { AuthGuard } from '../../guards/auth.guard';
import { prisma } from '../../lib/prisma';

class CreateMessageDto {
  content!: string;
  model?: string;
}

@ApiTags('messages')
@Controller('conversations/:conversationId/messages')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Messages d\'une conversation' })
  async findAll(@Param('conversationId') conversationId: string, @Req() req: any) {
    return this.messagesService.findByConversation(conversationId, req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Envoyer un message' })
  async create(
    @Param('conversationId') conversationId: string,
    @Body() body: CreateMessageDto,
    @Req() req: any
  ) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userId: true },
    });
    if (!conversation || conversation.userId !== req.user.userId) {
      throw new ForbiddenException('Acces interdit');
    }
    return this.messagesService.create(conversationId, 'user', body.content, { model: body.model });
  }
}
