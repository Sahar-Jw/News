import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MAX_IMAGES_PER_RECORD } from '../../common/constants';
import { CC } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { adminPage, paged, publicPage } from '../../common/utils/pagination';
import { isYmd, todayYmd } from '../../common/utils/dates';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { ContentStore, Rec } from '../content/content.store';
import { by, filterByCf, matches } from '../content/mem';
import { CreateOccasionDto, OccasionsAdminQueryDto, PublicOccasionsQueryDto, UpdateOccasionDto } from './occasions.dto';
import { removedChanges } from '../audit/audit-snapshot';

export type OccasionScope = 'all' | 'upcoming' | 'current' | 'previous' | 'exhibitions';

@Injectable()
export class OccasionsService {
  constructor(
    private readonly store: ContentStore,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
  ) {}

  private eventDate(r: Rec) {
    return String(r.x.eventDate ?? r.createdAt.toISOString().slice(0, 10));
  }

  private eventType(r: Rec): 'occasion' | 'exhibition' {
    return r.x.eventType === 'exhibition' ? 'exhibition' : 'occasion';
  }

  /** Admin shape. */
  present(r: Rec) {
    const images = r.images ?? [];
    const eventDate = this.eventDate(r);
    return {
      id: r.id,
      titleAr: r.title,
      titleEn: String(r.x.titleEn ?? ''),
      eventDate,
      finishDate: r.finishAt ?? eventDate,
      type: this.eventType(r),
      isUpcoming: eventDate >= todayYmd(),
      images,
      imageUrls: images.map((p) => this.storage.url(p)),
      imageCount: images.length,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private async all() {
    return (await this.store.list(CC.OCCASION)).filter((r) => r.x.isActive !== false);
  }

  private statusOf(r: Rec, today = todayYmd()) {
    const start = this.eventDate(r);
    const end = r.finishAt ?? start;
    return start > today ? 'upcoming' : end >= today ? 'current' : 'previous';
  }

  // ---------------------------------------------------------------- admin lists
  async list(q: OccasionsAdminQueryDto, scope: OccasionScope) {
    const today = todayYmd();
    let rows = await this.all();
    if (q.q) rows = rows.filter((r) => matches([r.title, r.x.titleEn, this.eventDate(r), r.finishAt], q.q!));
    rows = filterByCf<Rec>(rows, q.cf, {
      titleAr: (r) => [r.title],
      titleEn: (r) => [r.x.titleEn],
      eventDate: (r) => [this.eventDate(r)],
      finishDate: (r) => [r.finishAt],
      type: (r) => [this.eventType(r)],
    });
    if (q.from) rows = rows.filter((r) => (r.finishAt ?? this.eventDate(r)) >= q.from!.slice(0, 10));
    if (q.to) rows = rows.filter((r) => this.eventDate(r) <= q.to!.slice(0, 10));
    const effective = scope === 'all' && q.status ? q.status : scope;
    if (effective === 'upcoming' || effective === 'current' || effective === 'previous') rows = rows.filter((r) => this.statusOf(r, today) === effective);
    if (effective === 'exhibitions') rows = rows.filter((r) => this.eventType(r) === 'exhibition');
    if (q.type) rows = rows.filter((r) => this.eventType(r) === q.type);
    rows.sort((a, b) => effective === 'previous'
      ? by<Rec>((r) => this.eventDate(r))(b, a)
      : by<Rec>((r) => this.eventDate(r))(a, b));
    const p = adminPage(q);
    return paged(rows.slice(p.skip, p.skip + p.limit).map((r) => this.present(r)), rows.length, p);
  }

  // ---------------------------------------------------------------- create / update / delete
  private assertDates(start: string, finish: string) {
    if (!isYmd(start) || !isYmd(finish)) throw new BadRequestException('تاريخ البداية والنهاية غير صالح');
    if (finish < start) throw new BadRequestException('تاريخ النهاية يجب أن يكون في يوم البداية أو بعده');
  }

  async create(dto: CreateOccasionDto, files: Express.Multer.File[], actor: AuthUser) {
    this.assertDates(dto.eventDate, dto.finishDate);
    if ((files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const paths = await this.storage.saveImages(files ?? [], 'occasions');
    try {
      const saved = await this.store.create(CC.OCCASION, {
        title: dto.titleAr.trim(),
        images: paths,
        finishAt: dto.finishDate,
        x: { titleEn: dto.titleEn.trim(), eventDate: dto.eventDate, eventType: dto.type ?? 'occasion', isActive: true },
      });
      await this.audit.log({ category: 'occasions', action: 'create', description: `إضافة مناسبة: ${saved.title}`, actorId: actor.id, entityType: 'news', entityId: saved.id });
      return this.present(saved);
    } catch (error) {
      await this.storage.removeMany(paths);
      throw error;
    }
  }

  async update(id: number, dto: UpdateOccasionDto, files: Express.Multer.File[], actor: AuthUser) {
    const current = await this.store.get(id, CC.OCCASION);
    if (!current) throw new NotFoundException('المناسبة غير موجودة');
    const start = dto.eventDate ?? this.eventDate(current);
    const finish = dto.finishDate ?? current.finishAt ?? start;
    this.assertDates(start, finish);
    if ((files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const existing = current.images ?? [];
    const keep = dto.keepImages ?? existing;
    if (keep.some((p) => !existing.includes(p))) throw new BadRequestException('مسار صورة غير موجود في السجل');
    if (keep.length + (files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const removed = existing.filter((p) => !keep.includes(p));
    const added = await this.storage.saveImages(files ?? [], 'occasions');
    try {
      const saved = await this.store.update(id, {
        title: dto.titleAr?.trim(),
        images: [...keep, ...added],
        finishAt: finish,
        x: {
          titleEn: dto.titleEn?.trim(),
          eventDate: dto.eventDate,
          eventType: dto.type,
        },
      });
      if (!saved) throw new NotFoundException('المناسبة غير موجودة');
      await this.storage.removeMany(removed);
      await this.audit.log({ category: 'occasions', action: 'update', description: `تعديل مناسبة: ${saved.title}`, actorId: actor.id, entityType: 'news', entityId: id });
      return this.present(saved);
    } catch (error) {
      await this.storage.removeMany(added);
      throw error;
    }
  }

  async remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(CC.OCCASION);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض المناسبات غير موجودة');
    await this.store.remove(unique);
    await this.storage.removeMany(rows.flatMap((r) => r.images ?? []));
    await this.audit.log({ category: 'occasions', action: 'delete', description: `حذف ${rows.length} مناسبة`, actorId: actor.id, entityType: 'news', details: { ids: unique }, changes: removedChanges('news', rows.map((r) => this.present(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public
  private publicCard(r: Rec, lang: string) {
    const images = r.images ?? [];
    const eventDate = this.eventDate(r);
    return {
      id: r.id,
      title: lang === 'en' ? (r.x.titleEn || r.title) : r.title,
      date: eventDate,
      finishDate: r.finishAt ?? eventDate,
      type: this.eventType(r),
      status: this.statusOf(r),
      isUpcoming: this.statusOf(r) === 'upcoming',
      images: images.map((p) => this.storage.url(p)),
    };
  }

  async publicList(q: PublicOccasionsQueryDto) {
    const today = todayYmd();
    const scope = (q.scope as OccasionScope) ?? 'upcoming';
    let rows = await this.all();
    if (scope === 'upcoming' || scope === 'current' || scope === 'previous') rows = rows.filter((r) => this.statusOf(r, today) === scope);
    if (scope === 'exhibitions') rows = rows.filter((r) => this.eventType(r) === 'exhibition');
    if (q.type) rows = rows.filter((r) => this.eventType(r) === q.type);
    if (q.month) {
      const [year, month] = q.month.split('-').map(Number);
      const from = `${q.month}-01`;
      const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      rows = rows.filter((r) => this.eventDate(r) <= to && (r.finishAt ?? this.eventDate(r)) >= from);
    }
    rows.sort((a, b) => scope === 'previous'
      ? by<Rec>((r) => this.eventDate(r))(b, a)
      : by<Rec>((r) => this.eventDate(r))(a, b));
    const p = publicPage(q, q.month ? 50 : 12);
    const data = rows.slice(p.skip, p.skip + p.limit).map((r) => this.publicCard(r, q.lang ?? 'ar'));
    return paged(data, rows.length, p);
  }

  async publicOne(id: number, lang = 'ar') {
    const r = await this.store.get(id, CC.OCCASION);
    if (!r || r.x.isActive === false) throw new NotFoundException('المناسبة غير موجودة');
    return this.publicCard(r, lang);
  }
}
