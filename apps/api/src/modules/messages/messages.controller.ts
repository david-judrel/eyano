import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { AuthGuard } from '../../guards/auth.guard';

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
  async findAll(@Param('conversationId') conversationId: string) {
    return this.messagesService.findByConversation(conversationId);
  }

  @Post()
  @ApiOperation({ summary: 'Envoyer un message' })
  async create(
    @Param('conversationId') conversationId: string,
    @Body() body: CreateMessageDto
  ) {
    return this.messagesService.create(conversationId, 'user', body.content, { model: body.model });
  }
}
