import { AsyncLocalStorage } from 'async_hooks';

/**
 * One small object per HTTP request. AuditService.log() flips `logged` when anything is written to the audit log
 * while the request is being served; the coverage interceptor reads it afterwards to catch actions nobody logged.
 */
export interface AuditRequestState {
  logged: boolean;
}

export const auditRequestContext = new AsyncLocalStorage<AuditRequestState>();
