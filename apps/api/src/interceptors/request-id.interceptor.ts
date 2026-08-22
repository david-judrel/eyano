import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomBytes } from 'crypto';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] || `req_${randomBytes(8).toString('hex')}`;
    
    request.requestId = requestId;
    
    const now = Date.now();
    const method = request.method;
    const url = request.url;
    const userId = request.user?.userId || 'anonymous';

    return next.handle().pipe(
      tap(() => {
        const latency = Date.now() - now;
        console.log(`[${requestId}] ${method} ${url} user=${userId} ${latency}ms`);
      })
    );
  }
}
