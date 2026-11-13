'use client';
import { AuditLog } from '@/components/admin/audit-log';
import { RequirePerm } from '@/components/admin/guard';

/** Read-only: no add / edit / delete controls exist for audit logs. */
export default function AuditPage() {
  return <RequirePerm any={['audit.read']}><AuditLog /></RequirePerm>;
}
