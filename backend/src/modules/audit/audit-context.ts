import { AsyncLocalStorage } from 'async_hooks';

/** One data change captured while a request is served (see AuditChangeSubscriber). */
export interface AuditChange {
  /** table name, same value the services use as `entityType` */
  table: string;
  id: number | string | null;
  op: 'insert' | 'update' | 'remove';
  /** update: only the fields that changed; remove: the whole row */
  before?: Record<string, any>;
  /** update: only the fields that changed; insert: the whole row */
  after?: Record<string, any>;
}

/**
 * One small object per HTTP request. AuditService.log() flips `logged` when anything is written to the audit log
 * while the request is being served; the coverage interceptor reads it afterwards to catch actions nobody logged.
 * It also carries who/where the request came from and the row changes made while serving it, so every audit entry
 * gets IP, user agent, route and before/after values without each service having to pass them.
 */
export interface AuditRequestState {
  logged: boolean;
  ip?: string | null;
  userAgent?: string | null;
  method?: string | null;
  /** express request, only used to read the route pattern lazily (it is not known before routing) */
  req?: any;
  changes?: AuditChange[];
}

export const auditRequestContext = new AsyncLocalStorage<AuditRequestState>();
