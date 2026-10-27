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
import { auditRequestContext } from './audit-context';
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
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  /** Never throws: auditing must not break the business operation. */
  async log(e: AuditEntry): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          category: e.category.slice(0, 50),
          action: e.action.slice(0, 100),
          description: e.description.slice(0, 500),
          actorId: e.actorId ?? null,
          details: e.details ? scrubSecrets(e.details) : null,
          entityType: e.entityType ?? null,
          entityId: e.entityId ?? null,
        }),
      );
      const state = auditRequestContext.getStore();
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
