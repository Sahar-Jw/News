import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { AuditLog } from './audit-log.entity';
import { scrubSecrets, escapeLike } from '../../common/utils/text';
import { AuditListQueryDto } from './audit.dto';
import { adminPage, paged } from '../../common/utils/pagination';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { AuditChange, AuditRequestState, auditRequestContext } from './audit-context';
import { localize } from '../../common/i18n/messages';
import { ApiLang } from '../../common/i18n/request-lang';

export interface AuditEntry {
  category: string;
  action: string;
  description: string;
  actorId?: number | null;
  details?: Record<string, any> | null;
  entityType?: string | null;
  entityId?: number | null;
  /** Explicit row changes (needed for repo.delete(), which fires no TypeORM event). Normally picked up automatically. */
  changes?: AuditChange[] | null;
  /** Pass the request when logging outside the request context (guards run before the interceptor). */
  req?: any;
}

const MAX_CHANGES_JSON = 16_000;
const cleanIp = (ip?: string | null) => (ip ? ip.replace(/^::ffff:/, '').slice(0, 64) : null);

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  /** Takes the row changes captured for this entity during the request (each is used once). */
  private takeChanges(e: AuditEntry, state: AuditRequestState | undefined): AuditChange[] | null {
    let list: AuditChange[] | null = null;
    if (e.changes?.length) list = e.changes;
    else if (state?.changes?.length && e.entityType) {
      const mine = state.changes.filter((c) => c.table === e.entityType && (e.entityId == null || String(c.id) === String(e.entityId)));
      if (mine.length) {
        state.changes = state.changes.filter((c) => !mine.includes(c));
        list = mine;
      }
    }
    if (!list) return null;
    list = list.slice(0, 20);
    while (list.length > 1 && JSON.stringify(list).length > MAX_CHANGES_JSON) list = list.slice(0, Math.ceil(list.length / 2));
    return scrubSecrets(list);
  }

  /** Never throws: auditing must not break the business operation. */
  async log(e: AuditEntry): Promise<void> {
    try {
      const state = auditRequestContext.getStore();
      const req = e.req ?? state?.req;
      const route = req ? String(req.route?.path ?? req.path ?? '').slice(0, 200) || null : null;
      await this.repo.save(
        this.repo.create({
          category: e.category.slice(0, 50),
          action: e.action.slice(0, 100),
          description: e.description.slice(0, 500),
          actorId: e.actorId ?? null,
          details: e.details ? scrubSecrets(e.details) : null,
          entityType: e.entityType ?? null,
          entityId: e.entityId ?? null,
          changes: this.takeChanges(e, state),
          ip: cleanIp(e.req?.ip ?? state?.ip),
          userAgent: String(e.req?.headers?.['user-agent'] ?? state?.userAgent ?? '').slice(0, 255) || null,
          method: String(e.req?.method ?? state?.method ?? '').slice(0, 10) || null,
          route,
        }),
      );
      if (state) state.logged = true; // tells the coverage interceptor this request is already on record
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  /** Data leaving the system (CSV / Excel) is always recorded: who, what, how many rows, which columns. */
  async logExport(actor: AuthUser | undefined, o: { category: string; entityType: string; format?: string; rowCount: number; columns: string[] }): Promise<void> {
    const format = o.format === 'xlsx' ? 'xlsx' : 'csv'; // same default as sendExport()
    await this.log({
      category: o.category,
      action: 'export',
      description: `تصدير ${o.rowCount} سجل (${format})`,
      actorId: actor?.id ?? null,
      entityType: o.entityType,
      details: { format, rowCount: o.rowCount, columns: o.columns },
    });
  }

  private buildQuery(q: AuditListQueryDto) {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoin('a.actor', 'u')
      .addSelect(['u.id', 'u.fullName', 'u.email']);
    if (q.category) qb.andWhere('a.category = :cat', { cat: q.category });
    if (q.action) qb.andWhere('a.action = :act', { act: q.action });
    if (q.actorId) qb.andWhere('a.actorId = :actor', { actor: q.actorId });
    if (q.from) qb.andWhere('a.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('a.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(
        new Brackets((b) =>
          b.where('a.description ILIKE :like', { like }).orWhere('a.action ILIKE :like', { like }).orWhere('u.fullName ILIKE :like', { like }),
        ),
      );
    }
    applyColumnFilters(qb, q.cf, { createdAt: 'CAST(a.createdAt AS TEXT)', category: 'a.category', action: 'a.action', description: 'a.description', actor: ['u.fullName', 'u.email'] });
    qb.orderBy('a.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('a.id', 'DESC');
    return qb;
  }

  /** Descriptions are stored in Arabic; English readers get the English text (the stored row is untouched). */
  private localized<T extends { description: string }>(rows: T[], lang: ApiLang): T[] {
    return lang === 'en' ? rows.map((r) => Object.assign(r, { description: localize(r.description, lang) })) : rows;
  }

  async list(q: AuditListQueryDto, lang: ApiLang = 'ar') {
    const p = adminPage(q);
    const [rows, total] = await this.buildQuery(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(this.localized(rows, lang), total, p);
  }

  async listAll(q: AuditListQueryDto, lang: ApiLang = 'ar') {
    return this.localized(await this.buildQuery(q).take(10000).getMany(), lang);
  }
}
