import { Controller, Get, Patch, Param, Body, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuthGuard } from '../../guards/auth.guard';
import { AdminGuard, SuperAdminGuard } from '../../guards/admin.guard';
import { AuditService } from '../audit/audit.service';
import { UserRole, UserStatus } from '@prisma/client';

class UpdateRoleDto {
  role!: UserRole;
}

class UpdateStatusDto {
  status!: UserStatus;
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Tableau de bord admin' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Liste des utilisateurs' })
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus
  ) {
    return this.adminService.getUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      role,
      status,
    });
  }

  @Patch('users/:id/role')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'Modifier le role d\'un utilisateur (SUPER_ADMIN uniquement)' })
  async updateRole(
    @Param('id') id: string,
    @Body() body: UpdateRoleDto,
    @Req() req: any
  ) {
    // Cannot modify your own role
    if (id === req.user.userId) {
      throw new ForbiddenException('Vous ne pouvez pas modifier votre propre role');
    }

    await this.auditService.log({
      userId: req.user.userId,
      action: 'UPDATE_USER_ROLE',
      target: id,
      details: { newRole: body.role },
      ip: req.ip,
    });

    return this.adminService.updateUserRole(id, body.role);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Modifier le statut d\'un utilisateur' })
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
    @Req() req: any
  ) {
    // Cannot ban yourself
    if (id === req.user.userId) {
      throw new ForbiddenException('Vous ne pouvez pas modifier votre propre statut');
    }

    await this.auditService.log({
      userId: req.user.userId,
      action: 'UPDATE_USER_STATUS',
      target: id,
      details: { newStatus: body.status },
      ip: req.ip,
    });

    return this.adminService.updateUserStatus(id, body.status);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Logs d\'audit' })
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string
  ) {
    return this.auditService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      userId,
      action,
    });
  }

  @Get('audit/stats')
  @ApiOperation({ summary: 'Statistiques des logs d\'audit' })
  async getAuditStats() {
    return this.auditService.getStats();
  }
}
