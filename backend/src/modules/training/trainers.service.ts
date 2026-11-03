import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { Trainer } from './trainer.entity';
import { CreateTrainerDto, TrainersAdminQueryDto, UpdateTrainerDto } from './training.dto';

@Injectable()
export class TrainersService {
  constructor(
    @InjectRepository(Trainer) private readonly repo: Repository<Trainer>,
    private readonly audit: AuditService,
  ) {}

  private present(t: Trainer) {
    return { id: Number(t.id), nameAr: t.nameAr, nameEn: t.nameEn ?? '', bioAr: t.bioAr ?? '', bioEn: t.bioEn ?? '', isActive: t.isActive, createdAt: t.createdAt, updatedAt: t.updatedAt };
  }

  async list(q: TrainersAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('t');
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('t.nameAr ILIKE :like', { like }).orWhere('t.nameEn ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { nameAr: 't.nameAr', nameEn: 't.nameEn' });
    qb.orderBy('t.nameAr', 'ASC').addOrderBy('t.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  /** every trainer, for the course form's picker */
  async options() {
    const rows = await this.repo.find({ where: { isActive: true }, order: { nameAr: 'ASC' }, take: 500 });
    return rows.map((r) => ({ id: Number(r.id), name: r.nameAr }));
  }

  async create(dto: CreateTrainerDto, actor: AuthUser) {
    const t = await this.repo.save(this.repo.create({ nameAr: dto.nameAr.trim(), nameEn: dto.nameEn?.trim() || null, bioAr: dto.bioAr?.trim() || null, bioEn: dto.bioEn?.trim() || null, isActive: dto.isActive ?? true }));
    await this.audit.log({ category: 'training', action: 'create', description: `إضافة مدرب: ${t.nameAr}`, actorId: actor.id, entityType: 'trainers', entityId: t.id });
    return this.present(t);
  }

  async update(id: number, dto: UpdateTrainerDto, actor: AuthUser) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('المدرب غير موجود');
    if (dto.nameAr !== undefined) t.nameAr = dto.nameAr.trim();
    for (const f of ['nameEn', 'bioAr', 'bioEn'] as const) {
      const v = dto[f];
      if (v !== undefined) t[f] = typeof v === 'string' ? v.trim() || null : null;
    }
    if (dto.isActive !== undefined) t.isActive = dto.isActive;
    const saved = await this.repo.save(t);
    await this.audit.log({ category: 'training', action: 'update', description: `تعديل مدرب: ${saved.nameAr}`, actorId: actor.id, entityType: 'trainers', entityId: id });
    return this.present(saved);
  }

  remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض المدربين غير موجودين'); // nothing is deleted
    await this.repo.delete({ id: In(unique) }); // their courses stay, without a trainer (ON DELETE SET NULL)
    await this.audit.log({ category: 'training', action: 'delete', description: `حذف ${rows.length} مدرب`, actorId: actor.id, entityType: 'trainers', details: { ids: unique }, changes: removedChanges('trainers', rows) });
    return { deleted: rows.length };
  }
}
