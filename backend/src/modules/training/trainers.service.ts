import { Injectable, NotFoundException } from '@nestjs/common';
import { CC } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { ContentStore, Rec, isActive, s } from '../content/content.store';
import { by, filterByCf, matches, pageRows } from '../content/mem';
import { CreateTrainerDto, TrainersAdminQueryDto, UpdateTrainerDto } from './training.dto';

/** Trainers: news rows of the main category TRAINER (name = news title, bio = news body, English texts in `extra`). */
@Injectable()
export class TrainersService {
  constructor(
    private readonly store: ContentStore,
    private readonly audit: AuditService,
  ) {}

  private present(r: Rec) {
    return { id: r.id, nameAr: r.title, nameEn: s(r.x.nameEn), bioAr: r.body ?? '', bioEn: s(r.x.bioEn), isActive: isActive(r), createdAt: r.createdAt, updatedAt: r.updatedAt };
  }

  async list(q: TrainersAdminQueryDto) {
    let rows = (await this.store.list(CC.TRAINER)).map((r) => this.present(r));
    if (q.q) rows = rows.filter((t) => matches([t.nameAr, t.nameEn], q.q!));
    rows = filterByCf(rows, q.cf, { nameAr: (t) => [t.nameAr], nameEn: (t) => [t.nameEn] });
    rows.sort(by((t) => t.nameAr, (t) => t.id));
    return pageRows(rows, q, (t) => t);
  }

  /** every trainer, for the course form's picker */
  async options() {
    return (await this.store.list(CC.TRAINER)).filter(isActive).sort(by((r) => r.title, (r) => r.id)).slice(0, 500).map((r) => ({ id: r.id, name: r.title }));
  }

  async create(dto: CreateTrainerDto, actor: AuthUser) {
    const t = await this.store.create(CC.TRAINER, { title: dto.nameAr.trim(), body: dto.bioAr?.trim() || null, x: { nameEn: dto.nameEn?.trim() || null, bioEn: dto.bioEn?.trim() || null, isActive: dto.isActive ?? true } });
    await this.audit.log({ category: 'training', action: 'create', description: `إضافة مدرب: ${t.title}`, actorId: actor.id, entityType: 'trainers', entityId: t.id });
    return this.present(t);
  }

  async update(id: number, dto: UpdateTrainerDto, actor: AuthUser) {
    if (!(await this.store.get(id, CC.TRAINER))) throw new NotFoundException('المدرب غير موجود');
    const nz = (v: string | null | undefined) => (v === undefined ? undefined : typeof v === 'string' ? v.trim() || null : null);
    const t = await this.store.update(id, { title: dto.nameAr?.trim(), body: nz(dto.bioAr), x: { nameEn: nz(dto.nameEn), bioEn: nz(dto.bioEn), isActive: dto.isActive } });
    await this.audit.log({ category: 'training', action: 'update', description: `تعديل مدرب: ${t!.title}`, actorId: actor.id, entityType: 'trainers', entityId: id });
    return this.present(t!);
  }

  remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(CC.TRAINER);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض المدربين غير موجودين'); // nothing is deleted
    // their courses stay, without a trainer
    for (const c of (await this.store.list(CC.COURSE)).filter((c) => unique.includes(Number(c.x.trainerId)))) await this.store.update(c.id, { x: { trainerId: null } });
    await this.store.remove(unique);
    await this.audit.log({ category: 'training', action: 'delete', description: `حذف ${rows.length} مدرب`, actorId: actor.id, entityType: 'trainers', details: { ids: unique }, changes: removedChanges('trainers', rows.map((r) => this.present(r))) });
    return { deleted: rows.length };
  }
}
