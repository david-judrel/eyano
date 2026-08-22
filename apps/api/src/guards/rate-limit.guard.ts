import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private store = new Map<string, RateLimitEntry>();

  constructor(private reflector: Reflector) {
    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const role = request.user?.role || 'USER';

    if (!userId) return true;

    const limit = this.getLimit(role);
    const windowMs = 60000; // 1 minute
    const key = `rate:${userId}`;
    const now = Date.now();

    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (entry.count >= limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new HttpException(
        {
          message: 'Trop de requetes. Veuillez reessayer plus tard.',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    entry.count++;
    return true;
  }

  private getLimit(role: string): number {
    switch (role) {
      case 'SUPER_ADMIN':
        return 1000;
      case 'ADMIN':
        return 200;
      case 'USER':
      default:
        return 30;
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}
