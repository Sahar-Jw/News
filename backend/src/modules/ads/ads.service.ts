import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { MAX_IMAGES_PER_RECORD } from '../../common/constants';
import { AuthUser } from '../../common/types';
import { adminPage, paged } from '../../common/utils/pagination';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { isYmd, todayYmd } from '../../common/utils/dates';
import { escapeLike } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { Ad } from './ad.entity';
import { AdsAdminQueryDto, CreateAdDto, PublicAdsQueryDto, UpdateAdDto } from './ads.dto';

@Injectable()
export class AdsService {
  constructor(
    @InjectRepository(Ad) private readonly repo: Repository<Ad>,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
  ) {}

  /** running = active and today is inside [start, end]; scheduled = starts later; expired = ended; off = switched off */
  private state(a: Ad): 'running' | 'scheduled' | 'expired' | 'off' {
    const t = todayYmd();
    if (!a.isActive) return 'off';
    if (a.endDate < t) return 'expired';
    if (a.startDate > t) return 'scheduled';
    return 'running';
  }

  present(a: Ad) {
    const images = a.images ?? [];
    return {
      id: a.id, ownerCompany: a.ownerCompany, linkUrl: a.linkUrl, placement: a.placement, isActive: a.isActive,
      startDate: a.startDate, endDate: a.endDate, state: this.state(a),
      images, imageUrls: images.map((p) => this.storage.url(p)), imageCount: images.length, createdAt: a.createdAt, updatedAt: a.updatedAt,
    };
  }

  async list(q: AdsAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('a');
    if (q.placement) qb.andWhere('a.placement = :pl', { pl: q.placement });
    if (q.isActive !== undefined) qb.andWhere('a.isActive = :act', { act: q.isActive });
    if (q.from) qb.andWhere('a.endDate >= :from', { from: q.from.slice(0, 10) });
    if (q.to) qb.andWhere('a.startDate <= :to', { to: q.to.slice(0, 10) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('a.ownerCompany LIKE :like', { like }).orWhere('a.linkUrl LIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { ownerCompany: 'a.ownerCompany', linkUrl: 'a.linkUrl', startDate: 'a.startDate', endDate: 'a.endDate' });
    qb.orderBy('a.id', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  private assertDates(start: string, end: string) {
    if (!isYmd(start) || !isYmd(end)) throw new BadRequestException('التاريخ غير صالح');
    if (end < start) throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساوياً له');
  }

  async create(dto: CreateAdDto, files: Express.Multer.File[], actor: AuthUser) {
    this.assertDates(dto.startDate, dto.endDate);
    if (!files?.length) throw new BadRequestException('أضف صورة واحدة على الأقل');
    if (files.length > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const paths = await this.storage.saveImages(files, 'ads');
    try {
      const saved = await this.repo.save(
        this.repo.create({
          ownerCompany: dto.ownerCompany, linkUrl: dto.linkUrl, placement: dto.placement, isActive: dto.isActive ?? true,
          startDate: dto.startDate, endDate: dto.endDate, images: paths, createdById: actor.id,
        }),
      );
      await this.audit.log({ category: 'ads', action: 'create', description: `إضافة إعلان: ${saved.ownerCompany}`, actorId: actor.id, entityType: 'ads', entityId: saved.id });
      return this.present(saved);
    } catch (e) {
      await this.storage.removeMany(paths);
      throw e;
    }
  }

  async update(id: number, dto: UpdateAdDto, files: Express.Multer.File[], actor: AuthUser) {
    const a = await this.repo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('الإعلان غير موجود');
    this.assertDates(dto.startDate ?? a.startDate, dto.endDate ?? a.endDate);
    const existing = a.images ?? [];
    const keep = dto.keepImages ?? existing;
    if (keep.some((p) => !existing.includes(p))) throw new BadRequestException('مسار صورة غير موجود في السجل');
    if (keep.length + (files?.length ?? 0) < 1) throw new BadRequestException('يجب أن يحتوي الإعلان على صورة واحدة على الأقل');
    if (keep.length + (files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const removed = existing.filter((p) => !keep.includes(p));
    const added = await this.storage.saveImages(files ?? [], 'ads');
    try {
      a.ownerCompany = dto.ownerCompany ?? a.ownerCompany;
      a.linkUrl = dto.linkUrl ?? a.linkUrl;
      a.placement = dto.placement ?? a.placement;
      a.isActive = dto.isActive ?? a.isActive;
      a.startDate = dto.startDate ?? a.startDate;
      a.endDate = dto.endDate ?? a.endDate;
      a.images = [...keep, ...added];
      const saved = await this.repo.save(a);
      await this.storage.removeMany(removed);
      await this.audit.log({ category: 'ads', action: 'update', description: `تعديل إعلان: ${saved.ownerCompany}`, actorId: actor.id, entityType: 'ads', entityId: id });
      return this.present(saved);
    } catch (e) {
      await this.storage.removeMany(added);
      throw e;
    }
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الإعلانات غير موجودة');
    await this.repo.delete({ id: In(unique) });
    await this.storage.removeMany(rows.flatMap((r) => r.images ?? []));
    await this.audit.log({ category: 'ads', action: 'delete', description: `حذف ${rows.length} إعلان`, actorId: actor.id, entityType: 'ads', details: { ids: unique } });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public
  /** Only ads that are switched on and whose [start, end] range includes today. */
  async running(q: PublicAdsQueryDto) {
    const t = todayYmd();
    const qb = this.repo.createQueryBuilder('a').where('a.isActive = :on', { on: true }).andWhere('a.startDate <= :t', { t }).andWhere('a.endDate >= :t', { t });
    if (q.placement) qb.andWhere('a.placement = :pl', { pl: q.placement });
    const rows = await qb.orderBy('a.id', 'ASC').getMany();
    // never exposes created_by, dates or the active flag
    return rows.map((a) => ({ id: a.id, placement: a.placement, owner: a.ownerCompany, link: a.linkUrl, images: (a.images ?? []).map((p) => this.storage.url(p)) }));
  }
}
