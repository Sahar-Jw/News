/**
 * The audit log shows a SMALL set of action kinds (like Create / Update / Delete / Login of the task-management system), not the ~35 raw codes the services write.
 * The raw `action` stays in the row (it is what the services log and what the export contains); a kind is what the screen groups, filters and colours by.
 */
export const ACTION_KINDS: Record<string, string[]> = {
  create: ['create', 'register', 'role.create'],
  update: ['update', 'profile.update', 'profile.avatar', 'profile.cv', 'update.file', 'role.update', 'role.permissions.update', 'preferences', 'auto_publish'],
  delete: ['delete', 'role.delete', 'anonymize', 'retention.purge'],
  login: ['login'],
  logout: ['logout'],
  /** refused or failed attempts: wrong password, inactive account, permission denied ... */
  failed: ['login.failed', 'login.inactive', 'permission_denied', 'privilege_escalation_attempt', 'password.reset.request.ignored'],
  password: ['password.change', 'password.reset', 'password.reset.request'],
  export: ['export'],
  download: ['download', 'private.download'],
  /** somebody opened personal data (a contact message, a request): recorded, but not listed unless asked for */
  access: ['read'],
};
export const KIND_ORDER = ['create', 'update', 'delete', 'login', 'logout', 'failed', 'password', 'export', 'download', 'access', 'other'] as const;

/** The system's own safety-net entries: never listed (the SQL check in backend/sql still finds them). */
export const HIDDEN_ACTIONS = ['unlogged_request'];
/** Listed only when the "access" kind is chosen, so the default list is about changes and sign-ins. */
export const QUIET_ACTIONS = ACTION_KINDS.access;

const ALL_KNOWN = Object.values(ACTION_KINDS).flat();

export function kindOf(action: string): string {
  for (const [kind, list] of Object.entries(ACTION_KINDS)) if (list.includes(action)) return kind;
  return 'other';
}

/** SQL side of a kind filter: [condition, params]. `other` = everything that is not in any kind. */
export function kindCondition(kind: string, col = 'a.action'): [string, Record<string, any>] | null {
  if (kind === 'other') return [`${col} NOT IN (:...knownActions)`, { knownActions: [...ALL_KNOWN, ...HIDDEN_ACTIONS] }];
  const list = ACTION_KINDS[kind];
  return list ? [`${col} IN (:...kindActions)`, { kindActions: list }] : null;
}
