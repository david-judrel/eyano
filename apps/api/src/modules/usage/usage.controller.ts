import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsageService } from './usage.service';
import { AuthGuard } from '../../guards/auth.guard';
import { AdminGuard } from '../../guards/admin.guard';

@ApiTags('usage')
@Controller('usage')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  @ApiOperation({ summary: 'Statistiques d\'utilisation' })
  async getUsage(@Req() req: any) {
    return this.usageService.getUsage(req.user.userId);
  }

  @Get(':period')
  @ApiOperation({ summary: 'Statistiques par periode (today/month/all)' })
  async getUsageByPeriod(@Req() req: any, @Param('period') period: 'today' | 'month' | 'all') {
    return this.usageService.getUsageByPeriod(req.user.userId, period);
  }

  @Get('admin/global')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Statistiques globales (admin)' })
  async getGlobalStats() {
    return this.usageService.getGlobalStats();
  }
}
