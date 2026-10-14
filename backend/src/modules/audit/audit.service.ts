import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuditLog } from '../../entities';
import { scrubSecrets, escapeLike } from '../../common/utils/text';
import { AuditListQueryDto } from './audit.dto';
import { adminPage, paged } from '../../common/utils/pagination';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';

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
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
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
          b.where('a.description LIKE :like', { like }).orWhere('a.action LIKE :like', { like }).orWhere('u.fullName LIKE :like', { like }),
        ),
      );
    }
    qb.orderBy('a.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('a.id', 'DESC');
    return qb;
  }

  async list(q: AuditListQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.buildQuery(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows, total, p);
  }

  async listAll(q: AuditListQueryDto) {
    return this.buildQuery(q).take(10000).getMany();
  }
}
