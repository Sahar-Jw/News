import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const TTL_MS = 60_000; // SRS 15.3: role changes apply within 60 s, no re-login needed

@Injectable()
export class PermissionsService {
  private cache = new Map<number, { at: number; codes: Set<string> }>();

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async getRoleCodes(roleId: number): Promise<Set<string>> {
    const hit = this.cache.get(roleId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.codes;
    const rows: { code: string }[] = await this.ds.query(
      `SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`,
      [roleId],
    );
    const codes = new Set(rows.map((r) => r.code));
    this.cache.set(roleId, { at: Date.now(), codes });
    return codes;
  }

  invalidate(roleId?: number) {
    if (roleId == null) this.cache.clear();
    else this.cache.delete(roleId);
  }

  /** true when every code of `target` is also held by `actor` (anti-escalation, SRS 15.3-5). */
  static isSubset(target: Set<string>, actor: Set<string>): boolean {
    for (const c of target) if (!actor.has(c)) return false;
    return true;
  }
}
