import { Controller, Get, Patch, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../guards/auth.guard';
import { AuthService } from '../auth/auth.service';
import { prisma } from '../../lib/prisma';

class UpdateProfileDto {
  name?: string;
  avatarUrl?: string;
}

@ApiTags('users')
@Controller('users')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @ApiOperation({ summary: 'Profil utilisateur' })
  async me(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Modifier le profil' })
  async update(@Req() req: any, @Body() body: UpdateProfileDto) {
    const data: any = {};

    if (body.name !== undefined) {
      const name = body.name.trim();
      if (name.length < 3) {
        throw new BadRequestException('Le nom doit contenir au moins 3 caracteres');
      }
      if (name.length > 60) {
        throw new BadRequestException('Le nom ne doit pas depasser 60 caracteres');
      }
      data.name = name;
    }

    if (body.avatarUrl !== undefined) {
      data.avatarUrl = body.avatarUrl;
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data,
    });

    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  }
}
