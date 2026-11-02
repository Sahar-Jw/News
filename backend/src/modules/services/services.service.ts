import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { ChamberService, ServiceKind } from './service.entity';
import { CreateServiceDto, PublicServicesQueryDto, ServicesAdminQueryDto, UpdateServiceDto } from './services.dto';

/** text columns the admin form edits, copied the same way on create and update */
const TEXT_FIELDS = [
  'nameEn', 'descriptionAr', 'descriptionEn', 'audienceAr', 'audienceEn', 'documentsAr', 'documentsEn', 'stepsAr', 'stepsEn',
  'locationAr', 'locationEn', 'departmentAr', 'departmentEn', 'durationAr', 'durationEn', 'feeAr', 'feeEn', 'formUrl',
] as const;

const lines = (v: string | null | undefined) => (v ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(ChamberService) private readonly repo: Repository<ChamberService>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
  ) {}

  present(s: ChamberService) {
    const out: Record<string, unknown> = {
      id: s.id, kind: s.kind, nameAr: s.nameAr, sortOrder: s.sortOrder, isActive: s.isActive,
      imageUrl: this.storage.url(s.image), createdAt: s.createdAt, updatedAt: s.updatedAt,
    };
    for (const f of TEXT_FIELDS) out[f] = s[f] ?? '';
    return out;
  }

  async list(q: ServicesAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('s');
    if (q.kind) qb.andWhere('s.kind = :kind', { kind: q.kind });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('s.nameAr ILIKE :like', { like }).orWhere('s.nameEn ILIKE :like', { like }).orWhere('s.departmentAr ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { nameAr: 's.nameAr', nameEn: 's.nameEn', departmentAr: 's.departmentAr', feeAr: 's.feeAr' });
    qb.orderBy('s.sortOrder', 'ASC').addOrderBy('s.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  private apply(s: ChamberService, dto: CreateServiceDto | UpdateServiceDto) {
    if (dto.kind !== undefined) s.kind = dto.kind as ServiceKind;
    if (dto.nameAr !== undefined) s.nameAr = dto.nameAr.trim();
    for (const f of TEXT_FIELDS) {
      const v = (dto as Record<string, any>)[f];
      if (v !== undefined) s[f] = typeof v === 'string' ? v.trim() || null : null;
    }
    if (dto.sortOrder !== undefined) s.sortOrder = dto.sortOrder ?? 0;
    if (dto.isActive !== undefined) s.isActive = dto.isActive;
  }

  async create(dto: CreateServiceDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const path = image ? await this.storage.saveImage(image, 'services', 1200) : null;
    try {
      const s = this.repo.create({ image: path, isActive: true, sortOrder: 0 });
      this.apply(s, dto);
      const saved = await this.repo.save(s);
      await this.audit.log({ category: 'services', action: 'create', description: `إضافة خدمة: ${saved.nameAr}`, actorId: actor.id, entityType: 'services', entityId: saved.id });
      return this.present(saved);
    } catch (e) {
      await this.storage.remove(path); // nothing saved: do not leave an orphan file
      throw e;
    }
  }

  async update(id: number, dto: UpdateServiceDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('الخدمة غير موجودة');
    const newPath = image ? await this.storage.saveImage(image, 'services', 1200) : null;
    const oldPath = s.image;
    try {
      this.apply(s, dto);
      if (newPath) s.image = newPath;
      else if (dto.removeImage) s.image = null;
      const saved = await this.repo.save(s);
      await this.audit.log({ category: 'services', action: 'update', description: `تعديل خدمة: ${saved.nameAr}`, actorId: actor.id, entityType: 'services', entityId: id });
      if (oldPath && oldPath !== saved.image) await this.storage.remove(oldPath);
      return this.present(saved);
    } catch (e) {
      await this.storage.remove(newPath);
      throw e;
    }
  }

  remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الخدمات غير موجودة'); // nothing is deleted
    await this.repo.delete({ id: In(unique) });
    await this.storage.removeMany(rows.map((r) => r.image));
    await this.audit.log({ category: 'services', action: 'delete', description: `حذف ${rows.length} خدمة`, actorId: actor.id, entityType: 'services', details: { ids: unique }, changes: removedChanges('services', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public (active only)
  private card(s: ChamberService, en: boolean) {
    const pick = (ar: string | null, e: string | null) => (en && e) || ar || '';
    return {
      id: s.id, kind: s.kind, name: pick(s.nameAr, s.nameEn), description: pick(s.descriptionAr, s.descriptionEn),
      audience: pick(s.audienceAr, s.audienceEn), department: pick(s.departmentAr, s.departmentEn), duration: pick(s.durationAr, s.durationEn),
      fee: pick(s.feeAr, s.feeEn), location: pick(s.locationAr, s.locationEn), formUrl: s.formUrl ?? '',
      imageUrl: this.storage.url(s.image),
      documents: lines(en && s.documentsEn ? s.documentsEn : s.documentsAr), steps: lines(en && s.stepsEn ? s.stepsEn : s.stepsAr),
    };
  }

  /** The whole active catalogue (a few dozen rows): the One-Stop page filters, searches and builds its fees table from it. */
  async publicList(q: PublicServicesQueryDto) {
    const qb = this.repo.createQueryBuilder('s').where('s.isActive = true');
    if (q.kind) qb.andWhere('s.kind = :kind', { kind: q.kind });
    if (q.q?.trim()) {
      const like = `%${escapeLike(q.q.trim())}%`;
      qb.andWhere(new Brackets((b) => b.where('s.nameAr ILIKE :like', { like }).orWhere('s.nameEn ILIKE :like', { like }).orWhere('s.descriptionAr ILIKE :like', { like })));
    }
    const rows = await qb.orderBy('s.sortOrder', 'ASC').addOrderBy('s.id', 'ASC').take(200).getMany();
    const en = q.lang === 'en';
    return rows.map((r) => this.card(r, en));
  }

  async publicOne(id: number, lang: string) {
    const s = await this.repo.findOne({ where: { id, isActive: true } });
    if (!s) throw new NotFoundException('الخدمة غير موجودة');
    return this.card(s, lang === 'en');
  }
}
