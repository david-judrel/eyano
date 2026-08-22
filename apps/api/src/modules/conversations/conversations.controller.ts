import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { AuthGuard } from '../../guards/auth.guard';

class CreateConversationDto {
  title?: string;
}

class UpdateConversationDto {
  title?: string;
  archived?: boolean;
}

@ApiTags('conversations')
@Controller('conversations')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: 'Creer une conversation' })
  async create(@Req() req: any, @Body() body: CreateConversationDto) {
    return this.conversationsService.create(req.user.userId, { title: body.title });
  }

  @Get()
  @ApiOperation({ summary: 'Lister les conversations' })
  async findAll(@Req() req: any) {
    return this.conversationsService.findAll(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détails d\'une conversation' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.conversationsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une conversation' })
  async update(@Param('id') id: string, @Req() req: any, @Body() body: UpdateConversationDto) {
    return this.conversationsService.update(id, req.user.userId, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une conversation' })
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.conversationsService.remove(id, req.user.userId);
  }
}
