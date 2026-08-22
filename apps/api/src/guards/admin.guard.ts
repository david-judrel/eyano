import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Acces interdit');
    }

    const adminRoles: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];
    if (!adminRoles.includes(user.role)) {
      throw new ForbiddenException('Droits administrateur requis');
    }

    return true;
  }
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Acces interdit');
    }

    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Droits super administrateur requis');
    }

    return true;
  }
}
