import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { AuditService } from './audit.service';

/** Map HTTP methods to audit actions */
const METHOD_ACTION: Record<string, string> = {
  POST: 'create',
  PATCH: 'update',
  PUT: 'update',
  DELETE: 'delete',
};

/** Extract entity type from URL path: /api/quality/ncr/123 → ncr */
function extractEntityType(path: string): string {
  const segments = path.replace(/^\/api\//, '').split('/').filter(Boolean);
  // Skip known prefixes
  const skip = ['tools', 'shopfloor', 'dashboard', 'corporate'];
  for (const seg of segments) {
    if (skip.includes(seg)) continue;
    // Skip IDs (cuid-like strings)
    if (seg.length > 20 || /^[a-z0-9]{25}$/.test(seg)) continue;
    return seg.replace(/-/g, '_');
  }
  return segments[0] || 'unknown';
}

/** Extract entity ID from URL path or response body */
function extractEntityId(path: string, body?: any): string | undefined {
  // Try to get ID from URL: /api/quality/ncr/:id
  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && last.length > 20) return last;
  // Try from response body
  return body?.id;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;

    // Only log state-changing methods
    if (!METHOD_ACTION[method]) return next.handle();

    const action = METHOD_ACTION[method];
    const path: string = req.path || req.url;
    const entityType = extractEntityType(path);
    const user = req.user;
    const ip = req.ip || req.headers?.['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers?.['user-agent'] || '';

    return next.handle().pipe(
      tap((responseBody) => {
        const entityId = extractEntityId(path, responseBody);
        this.audit.log({
          userId: user?.sub || user?.id,
          userEmail: user?.email,
          action,
          entityType,
          entityId,
          ipAddress: ip,
          userAgent,
          result: 'success',
        });
      }),
      catchError((err) => {
        this.audit.log({
          userId: user?.sub || user?.id,
          userEmail: user?.email,
          action,
          entityType,
          entityId: extractEntityId(path),
          metadata: { error: err.message },
          ipAddress: ip,
          userAgent,
          result: 'failure',
        });
        return throwError(() => err);
      }),
    );
  }
}
