import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, defer, from, of } from 'rxjs';
import { tap } from 'rxjs/operators';

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 2000;
const KEY_RE = /^[A-Za-z0-9_-]{8,80}$/;

/**
 * Safe retries: when a request carries an `Idempotency-Key` (the site sends one with every "add" it makes), the SAME key arriving again
 * within ten minutes never runs the action a second time:
 *  - while the first one is still running, the second waits for it and gets its answer;
 *  - once the first one finished, the second gets the stored answer.
 * This is what keeps a slow or dropped Wi-Fi connection from adding the same record twice when the sender (or the browser) tries again.
 * Only successful answers are kept (a failed attempt may be repeated), and sign-in is left out because it sets cookies.
 * Kept in memory of this process: a restart simply forgets the keys.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly done = new Map<string, { at: number; status: number; body: unknown }>();
  private readonly running = new Map<string, Promise<{ status: number; body: unknown }>>();

  private prune() {
    const now = Date.now();
    for (const [k, v] of this.done) {
      if (now - v.at > TTL_MS || this.done.size > MAX_ENTRIES) this.done.delete(k);
      else break; // insertion order = age order: the rest is younger
    }
  }

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const key = req.headers?.['idempotency-key'];
    const path = String(req.route?.path ?? req.path ?? '');
    if (req.method !== 'POST' || typeof key !== 'string' || !KEY_RE.test(key) || path.includes('/auth/')) return next.handle();

    const scope = `${req.user?.id ?? req.ip}|${req.method} ${path}|${key}`;
    this.prune();
    const hit = this.done.get(scope);
    if (hit && Date.now() - hit.at < TTL_MS) {
      res.status(hit.status);
      res.setHeader('Idempotent-Replay', 'true');
      return of(hit.body);
    }
    const waiting = this.running.get(scope);
    if (waiting) {
      return from(waiting.then((r) => { res.status(r.status); res.setHeader('Idempotent-Replay', 'true'); return r.body; }));
    }

    let settle!: (v: { status: number; body: unknown }) => void;
    let fail!: (e: unknown) => void;
    const p = new Promise<{ status: number; body: unknown }>((ok, no) => { settle = ok; fail = no; });
    p.catch(() => undefined); // nobody may be waiting: never an unhandled rejection
    this.running.set(scope, p);
    return defer(() => next.handle()).pipe(
      tap({
        next: (body) => {
          this.running.delete(scope);
          // answers sent by hand (files, exports) have no body to replay
          if (body !== undefined && !res.headersSent) this.done.set(scope, { at: Date.now(), status: res.statusCode, body });
          settle({ status: res.statusCode, body });
        },
        error: (e) => { this.running.delete(scope); fail(e); },
        complete: () => { this.running.delete(scope); },
      }),
    );
  }
}
