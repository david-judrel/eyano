import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { verifyToken } from '@eyano/auth';
import { prisma } from '../lib/prisma';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token manquant');
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      throw new UnauthorizedException('Token invalide');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte desactive');
    }

    request.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return true;
  }
}
