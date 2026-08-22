import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class RoleGuard {
  private allowedRoles: UserRole[];

  constructor(...roles: UserRole[]) {
    this.allowedRoles = roles;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Acces interdit');
    }

    if (!this.allowedRoles.includes(user.role)) {
      throw new ForbiddenException('Droits insuffisants');
    }

    return true;
  }
}

// Decorator for convenience
export function RequireRoles(...roles: UserRole[]) {
  return function (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) {
    if (descriptor) {
      Reflect.defineMetadata('roles', roles, descriptor.value);
    }
    return target;
  };
}
