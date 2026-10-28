import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { MAX_IMAGES_PER_RECORD } from '../../common/constants';
import { AuthUser } from '../../common/types';
import { adminPage, paged, publicPage } from '../../common/utils/pagination';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { isYmd, todayYmd } from '../../common/utils/dates';
import { escapeLike } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { Occasion } from './occasion.entity';
import { CreateOccasionDto, OccasionsAdminQueryDto, PublicOccasionsQueryDto, UpdateOccasionDto } from './occasions.dto';
import { removedChanges } from '../audit/audit-snapshot';

export type OccasionScope = 'all' | 'upcoming' | 'previous';

@Injectable()
export class OccasionsService {
  constructor(
    @InjectRepository(Occasion) private readonly repo: Repository<Occasion>,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
  ) {}

  /** Admin shape. */
  present(o: Occasion) {
    const images = o.images ?? [];
    return {
      id: o.id,
      titleAr: o.titleAr,
      titleEn: o.titleEn,
      eventDate: o.eventDate,
      isUpcoming: o.eventDate >= todayYmd(),
      images,
      imageUrls: images.map((p) => this.storage.url(p)),
      imageCount: images.length,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    };
  }

  private applyScope(qb: ReturnType<Repository<Occasion>['createQueryBuilder']>, scope: OccasionScope) {
    const today = todayYmd();
    if (scope === 'upcoming') qb.andWhere('o.eventDate >= :today', { today }).orderBy('o.eventDate', 'ASC').addOrderBy('o.id', 'ASC');
    else if (scope === 'previous') qb.andWhere('o.eventDate < :today', { today }).orderBy('o.eventDate', 'DESC').addOrderBy('o.id', 'DESC');
    else qb.orderBy('o.eventDate', 'DESC').addOrderBy('o.id', 'DESC');
  }

  // ---------------------------------------------------------------- admin lists
  async list(q: OccasionsAdminQueryDto, scope: OccasionScope) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('o');
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('o.titleAr ILIKE :like', { like }).orWhere('o.titleEn ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { titleAr: 'o.titleAr', titleEn: 'o.titleEn', eventDate: 'o.eventDate' });
    if (q.from) qb.andWhere('o.eventDate >= :from', { from: q.from.slice(0, 10) });
    if (q.to) qb.andWhere('o.eventDate <= :to', { to: q.to.slice(0, 10) });
    const effective: OccasionScope = scope === 'all' && q.status ? (q.status as OccasionScope) : scope;
    this.applyScope(qb, effective);
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  // ---------------------------------------------------------------- create / update / delete
  private assertDate(v: string) {
    if (!isYmd(v)) throw new BadRequestException('التاريخ غير صالح');
  }

  async create(dto: CreateOccasionDto, files: Express.Multer.File[], actor: AuthUser) {
    this.assertDate(dto.eventDate);
    if ((files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const paths = await this.storage.saveImages(files ?? [], 'occasions'); // validated first, rolled back on failure
    try {
      const saved = await this.repo.save(
        this.repo.create({ titleAr: dto.titleAr.trim(), titleEn: dto.titleEn.trim(), eventDate: dto.eventDate, images: paths, createdById: actor.id }),
      );
      await this.audit.log({ category: 'occasions', action: 'create', description: `إضافة مناسبة: ${saved.titleAr}`, actorId: actor.id, entityType: 'occasions', entityId: saved.id });
      return this.present(saved);
    } catch (e) {
      await this.storage.removeMany(paths);
      throw e;
    }
  }

  async update(id: number, dto: UpdateOccasionDto, files: Express.Multer.File[], actor: AuthUser) {
    const o = await this.repo.findOne({ where: { id } });
    if (!o) throw new NotFoundException('المناسبة غير موجودة');
    if (dto.eventDate !== undefined) this.assertDate(dto.eventDate);
    const existing = o.images ?? [];
    const keep = dto.keepImages ?? existing;
    if (keep.some((p) => !existing.includes(p))) throw new BadRequestException('مسار صورة غير موجود في السجل');
    if (keep.length + (files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const removed = existing.filter((p) => !keep.includes(p));
    const added = await this.storage.saveImages(files ?? [], 'occasions');
    try {
      o.titleAr = dto.titleAr?.trim() ?? o.titleAr;
      o.titleEn = dto.titleEn?.trim() ?? o.titleEn;
      o.eventDate = dto.eventDate ?? o.eventDate;
      o.images = [...keep, ...added];
      const saved = await this.repo.save(o);
      await this.storage.removeMany(removed); // only after the save succeeded
      await this.audit.log({ category: 'occasions', action: 'update', description: `تعديل مناسبة: ${saved.titleAr}`, actorId: actor.id, entityType: 'occasions', entityId: id });
      return this.present(saved);
    } catch (e) {
      await this.storage.removeMany(added);
      throw e;
    }
  }

  async remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض المناسبات غير موجودة'); // nothing is deleted
    await this.repo.delete({ id: In(unique) });
    await this.storage.removeMany(rows.flatMap((r) => r.images ?? []));
    await this.audit.log({ category: 'occasions', action: 'delete', description: `حذف ${rows.length} مناسبة`, actorId: actor.id, entityType: 'occasions', details: { ids: unique }, changes: removedChanges('occasions', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public
  private publicCard(o: Occasion, lang: string) {
    return {
      id: o.id,
      title: lang === 'en' ? o.titleEn : o.titleAr,
      date: o.eventDate,
      isUpcoming: o.eventDate >= todayYmd(),
      images: (o.images ?? []).map((p) => this.storage.url(p)),
    };
  }

  async publicList(q: PublicOccasionsQueryDto) {
    const p = publicPage(q);
    const qb = this.repo.createQueryBuilder('o');
    this.applyScope(qb, (q.scope as OccasionScope) ?? 'upcoming');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.publicCard(r, q.lang ?? 'ar')), total, p);
  }

  async publicOne(id: number, lang = 'ar') {
    const o = await this.repo.findOne({ where: { id } });
    if (!o) throw new NotFoundException('المناسبة غير موجودة');
    return this.publicCard(o, lang); // never exposes created_by
  }
}
