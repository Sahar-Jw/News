import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { AuthRequest } from '../../common/types';
import { auditRequestContext, AuditRequestState } from './audit-context';
import { AuditService } from './audit.service';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const isExport = (req: AuthRequest) => req.method === 'GET' && /\/export\/?$/.test(req.path);

/**
 * Opens the per-request audit context for every HTTP request (see audit-context.ts) and acts as a safety net.
 * Safety net, not the main mechanism: every service writes its own, descriptive audit entry.
 * If a request that changes data (POST / PUT / PATCH / DELETE) or exports it finishes successfully and NOTHING was
 * written to the audit log while serving it, one `system / unlogged_request` entry is added, so the action can never
 * pass without a trace (this also covers endpoints added in the future). A healthy system has none of these rows;
 * see backend/sql/audit-coverage-check.sql.
 */
@Injectable()
export class AuditCoverageInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<AuthRequest>();
    const mustBeLogged = WRITE_METHODS.has(req.method) || isExport(req);

    // every request gets a context (who / where from / row changes); only writes and exports are checked for a log entry
    const state: AuditRequestState = {
      logged: false,
      ip: req.ip ?? null,
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 255) || null,
      method: req.method,
      req,
      changes: [],
    };
    // The handler must START inside run(), otherwise the async context does not follow it into the services.
    return new Observable((subscriber) => {
      const sub = auditRequestContext.run(state, () =>
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e), // failed request: nothing changed, nothing to add
          complete: () => {
            if (!mustBeLogged) return subscriber.complete();
            this.ensureLogged(req, http.getResponse<Response>(), state).finally(() => subscriber.complete());
          },
        }),
      );
      return () => sub.unsubscribe();
    });
  }

  private async ensureLogged(req: AuthRequest, res: Response, state: AuditRequestState): Promise<void> {
    if (state.logged) return;
    // the route pattern (/admin/ads/:id), never the real URL: no ids, tokens or query strings end up in the log
    const route = String(req.route?.path ?? req.path).slice(0, 200);
    await this.audit.log({
      category: 'system',
      action: 'unlogged_request',
      description: `إجراء ناجح دون سجل مخصص: ${req.method} ${route}`,
      actorId: req.user?.id ?? null,
      details: { method: req.method, route, statusCode: res.statusCode },
    });
  }
}
