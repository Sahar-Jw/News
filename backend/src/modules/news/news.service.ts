import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import {
  Language,
  MAX_IMAGES_PER_RECORD,
  NewsStatus,
  PERM,
  SPECIAL_CATEGORY_CODES,
  SPECIAL_CATEGORY_CONFIG,
  SpecialCategory,
} from '../../common/constants';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { adminPage, paged } from '../../common/utils/pagination';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { codeKey, escapeLike, normalizeLabel, sanitizeRichText } from '../../common/utils/text';
import { News } from './news.entity';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { CreateNewsDto, NewsAdminQueryDto, UpdateNewsDto } from './news.dto';
import { onlyRegular } from './news.eligibility';

const LIST_COLUMNS = [
  'id', 'title', 'subject', 'mainCategory', 'subcategory', 'topics', 'images', 'rating', 'isFeatured',
  'publishAt', 'status', 'language', 'visibility', 'viewCount', 'createdAt', 'updatedAt', 'createdById',
];

@Injectable()
export class NewsService {
  constructor(
    @InjectRepository(News) private readonly repo: Repository<News>,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
  ) {}

  present(n: News) {
    const { createdBy, ...rest } = n as any;
    return { ...rest, imageUrls: (n.images ?? []).map((p) => this.storage.url(p)), createdByName: createdBy?.fullName };
  }

  // ---------------------------------------------------------------- listing
  private buildAdminQuery(q: NewsAdminQueryDto, withBody = false) {
    const qb = this.repo.createQueryBuilder('n');
    qb.select(LIST_COLUMNS.map((c) => `n.${c}`));
    if (withBody) qb.addSelect('n.body');
    if (q.language) qb.andWhere('n.language = :language', { language: q.language });
    if (q.status) qb.andWhere('n.status = :status', { status: q.status });
    if (q.visibility) qb.andWhere('n.visibility = :visibility', { visibility: q.visibility });
    if (q.isFeatured !== undefined) qb.andWhere('n.isFeatured = :feat', { feat: q.isFeatured });
    if (q.section) {
      const sec = codeKey(q.section);
      if (q.section.toLowerCase() === 'regular') onlyRegular(qb, 'n');
      else if (SPECIAL_CATEGORY_CODES.includes(sec)) qb.andWhere('n.mainCategory = :sec', { sec });
      else throw new BadRequestException('قسم غير معروف');
    }
    if (q.mainCategory) qb.andWhere('n.mainCategory = :mc', { mc: normalizeLabel(q.mainCategory) });
    if (q.subcategory) qb.andWhere('n.subcategory = :sc', { sc: normalizeLabel(q.subcategory) });
    if (q.topic) qb.andWhere('CAST(n.topics AS CHAR) LIKE :topic', { topic: `%${escapeLike(JSON.stringify(normalizeLabel(q.topic)))}%` });
    if (q.from) qb.andWhere('COALESCE(n.publishAt, n.createdAt) >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('COALESCE(n.publishAt, n.createdAt) <= :to', { to: dayEnd(q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(
        new Brackets((b) =>
          b.where('n.title LIKE :like', { like }).orWhere('n.subject LIKE :like', { like }).orWhere('n.mainCategory LIKE :like', { like }).orWhere('n.subcategory LIKE :like', { like }),
        ),
      );
    }
    applyColumnFilters(qb, q.cf, { title: 'n.title', subject: 'n.subject', mainCategory: 'n.mainCategory', subcategory: 'n.subcategory', topics: 'CAST(n.topics AS CHAR)', publishAt: 'CAST(n.publishAt AS CHAR)', viewCount: 'CAST(n.viewCount AS CHAR)' });
    qb.orderBy('n.id', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC');
    return qb;
  }

  async list(q: NewsAdminQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.buildAdminQuery(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  listAllForExport(q: NewsAdminQueryDto) {
    return this.buildAdminQuery(q).take(10000).getMany();
  }

  async get(id: number) {
    const n = await this.repo.findOne({ where: { id }, relations: { createdBy: true }, select: { createdBy: { id: true, fullName: true } } as any });
    if (!n) throw new NotFoundException('السجل غير موجود');
    return this.present(n);
  }

  /**
   * Dropdown values come from the real DISTINCT values in `news` (SRS 13.2) – there is no categories table.
   * Main category and subcategory are two independent lists: neither is filtered by the other.
   */
  async categories() {
    const main = await this.repo
      .createQueryBuilder('n')
      .select('DISTINCT n.mainCategory', 'v')
      .where('n.mainCategory NOT IN (:...sp)', { sp: SPECIAL_CATEGORY_CODES })
      .orderBy('v', 'ASC')
      .getRawMany();
    const sub = await this.repo
      .createQueryBuilder('n')
      .select('DISTINCT n.subcategory', 'v')
      .where('n.subcategory IS NOT NULL')
      .orderBy('v', 'ASC')
      .getRawMany();
    return { main: main.map((r) => r.v), sub: sub.map((r) => r.v), special: SPECIAL_CATEGORY_CODES };
  }

  // ---------------------------------------------------------------- validation helpers
  private async canonical(kind: 'main' | 'sub', value: string): Promise<string | null> {
    const qb = this.repo.createQueryBuilder('n');
    if (kind === 'main') qb.select('n.mainCategory', 'v').where('n.mainCategory = :v', { v: value });
    else qb.select('n.subcategory', 'v').where('n.subcategory = :v', { v: value });
    const r = await qb.limit(1).getRawOne();
    return r?.v ?? null; // case-insensitive match returns the stored spelling
  }

  private async regularValue(kind: 'main' | 'sub', raw: string, perms: Set<string>): Promise<string> {
    const v = normalizeLabel(raw);
    if (!v) throw new BadRequestException('قيمة الفئة فارغة');
    if (v.length > 100) throw new BadRequestException('اسم الفئة أطول من 100 حرف');
    const existing = await this.canonical(kind, v);
    if (existing) return existing;
    if (!perms.has(PERM.NEWS_CATEGORY_CREATE)) throw new ForbiddenException('ليست لديك صلاحية إضافة فئة جديدة');
    return v;
  }

  private async resolveCategories(
    input: { mainCategory?: string; subcategory?: string | null; section?: string },
    perms: Set<string>,
    existing?: News,
  ): Promise<{ main: string; sub: string | null }> {
    let main: string;
    if (!existing) {
      if (input.section) {
        if (input.mainCategory && codeKey(input.mainCategory) !== input.section) throw new BadRequestException('الفئة الرئيسية لا تطابق القسم');
        main = input.section;
      } else {
        if (!input.mainCategory) throw new BadRequestException('الفئة الرئيسية مطلوبة');
        const norm = normalizeLabel(input.mainCategory);
        if (SPECIAL_CATEGORY_CODES.includes(codeKey(norm))) throw new BadRequestException('هذه القيمة رمز محجوز لقسم خاص ولا تُستخدم في نموذج الأخبار العادية');
        main = await this.regularValue('main', norm, perms);
      }
    } else {
      main = existing.mainCategory;
      if (input.mainCategory !== undefined) {
        const norm = normalizeLabel(input.mainCategory ?? '');
        if (!norm) throw new BadRequestException('الفئة الرئيسية مطلوبة');
        const special = SPECIAL_CATEGORY_CODES.includes(codeKey(norm));
        const candidate = special ? codeKey(norm) : norm;
        if (candidate.toLowerCase() !== existing.mainCategory.toLowerCase()) {
          if (!perms.has(PERM.NEWS_CATEGORY_CHANGE)) throw new ForbiddenException('ليست لديك صلاحية تغيير الفئة الرئيسية');
          main = special ? candidate : await this.regularValue('main', norm, perms);
        }
      }
    }

    let sub: string | null;
    const given = input.subcategory === undefined ? undefined : input.subcategory === null || !normalizeLabel(input.subcategory) ? null : normalizeLabel(input.subcategory);
    if (SPECIAL_CATEGORY_CODES.includes(main)) {
      if (given && !SPECIAL_CATEGORY_CONFIG[main as SpecialCategory].supportsSubcategory) {
        throw new BadRequestException('هذا القسم الخاص لا يدعم الفئة الفرعية');
      }
      sub = null;
    } else if (given === undefined) {
      sub = existing ? existing.subcategory : null; // independent of the main category: changing main never resets sub
    } else if (given === null) {
      sub = null;
    } else {
      sub = await this.regularValue('sub', given, perms);
    }
    return { main, sub };
  }

  private resolvePublishing(
    dto: { status?: NewsStatus; publishAt?: string | null },
    existing: News | undefined,
    perms: Set<string>,
  ): { status: NewsStatus; publishAt: Date | null } {
    const now = new Date();
    const status = dto.status ?? existing?.status ?? NewsStatus.DRAFT;
    const providedAt = dto.publishAt !== undefined;
    let publishAt: Date | null = providedAt ? (dto.publishAt ? new Date(dto.publishAt) : null) : existing?.publishAt ?? null;
    if (publishAt && Number.isNaN(publishAt.getTime())) throw new BadRequestException('تاريخ النشر غير صالح');

    const statusChanged = existing ? status !== existing.status : status !== NewsStatus.DRAFT;
    if (statusChanged && !perms.has(PERM.NEWS_PUBLISH)) throw new ForbiddenException('ليست لديك صلاحية النشر أو الجدولة');

    if (providedAt || statusChanged) {
      if (status === NewsStatus.SCHEDULED) {
        if (!publishAt) throw new BadRequestException('وقت النشر مطلوب للحالة المجدولة');
        if (publishAt.getTime() <= now.getTime()) throw new BadRequestException('وقت الجدولة يجب أن يكون في المستقبل'); // SRS 26
      } else if (status === NewsStatus.PUBLISHED) {
        if (!publishAt) publishAt = now;
        else if (publishAt.getTime() > now.getTime() + 60_000) throw new BadRequestException('لنشر في وقت مستقبلي استخدم الحالة "مجدولة"');
      }
    }
    return { status, publishAt };
  }

  private normalizeTopics(list?: string[]): string[] | undefined {
    if (list === undefined) return undefined;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of list) {
      const v = normalizeLabel(t).slice(0, 100);
      if (v && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase());
        out.push(v);
      }
    }
    return out;
  }

  private resolveRating(main: string, given: number | null | undefined, existing?: News): number | null {
    if (main !== SpecialCategory.TESTIMONIALS) {
      if (given != null) throw new BadRequestException('التقييم متاح لقسم آراء العملاء فقط');
      return null;
    }
    return given !== undefined ? given : existing?.rating ?? null;
  }

  // ---------------------------------------------------------------- create / update / delete
  async create(dto: CreateNewsDto, files: Express.Multer.File[], actor: AuthUser) {
    const perms = actor.permissions;
    if ((files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const { main, sub } = await this.resolveCategories(dto, perms);
    const pub = this.resolvePublishing(dto, undefined, perms);
    const rating = this.resolveRating(main, dto.rating);

    const imagePaths = await this.storage.saveImages(files ?? [], 'news'); // validated first, rolled back on failure
    try {
      const saved = await this.repo.save(
        this.repo.create({
          title: dto.title.trim(),
          subject: dto.subject?.trim() || null,
          mainCategory: main,
          subcategory: sub,
          topics: this.normalizeTopics(dto.topics) ?? [],
          body: sanitizeRichText(dto.body),
          images: imagePaths,
          rating,
          isFeatured: dto.isFeatured ?? false,
          publishAt: pub.publishAt,
          status: pub.status,
          language: dto.language ?? Language.AR,
          visibility: dto.visibility,
          createdById: actor.id,
        }),
      );
      await this.audit.log({ category: 'news', action: 'create', description: `إنشاء سجل: ${saved.title}`, actorId: actor.id, entityType: 'news', entityId: saved.id, details: { mainCategory: main, status: pub.status } });
      return this.get(saved.id);
    } catch (e) {
      await this.storage.removeMany(imagePaths);
      throw e;
    }
  }

  async update(id: number, dto: UpdateNewsDto, files: Express.Multer.File[], actor: AuthUser) {
    const n = await this.repo.findOne({ where: { id } });
    if (!n) throw new NotFoundException('السجل غير موجود');
    const perms = actor.permissions;

    const { main, sub } = await this.resolveCategories(dto, perms, n);
    const pub = this.resolvePublishing(dto, n, perms);
    const rating = this.resolveRating(main, dto.rating, n);

    // image reconciliation: keep ∖ existing is rejected, existing ∖ keep is removed AFTER the save succeeds
    const existingImgs = n.images ?? [];
    const keep = dto.keepImages ?? existingImgs;
    if (keep.some((p) => !existingImgs.includes(p))) throw new BadRequestException('مسار صورة غير موجود في السجل');
    const removed = existingImgs.filter((p) => !keep.includes(p));
    if (keep.length + (files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const added = await this.storage.saveImages(files ?? [], 'news');

    try {
      const topics = this.normalizeTopics(dto.topics);
      Object.assign(n, {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.subject !== undefined && { subject: dto.subject?.trim() || null }),
        ...(dto.body !== undefined && { body: sanitizeRichText(dto.body) }),
        ...(topics !== undefined && { topics }),
        ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.visibility !== undefined && { visibility: dto.visibility }),
        mainCategory: main,
        subcategory: sub,
        rating,
        status: pub.status,
        publishAt: pub.publishAt,
        images: [...keep, ...added],
      });
      await this.repo.save(n);
    } catch (e) {
      await this.storage.removeMany(added); // change cancelled completely
      throw e;
    }
    await this.removeFilesIfUnreferenced(removed);
    await this.audit.log({ category: 'news', action: 'update', description: `تعديل سجل: ${n.title}`, actorId: actor.id, entityType: 'news', entityId: id, details: { status: n.status, removedImages: removed.length, addedImages: added.length } });
    return this.get(id);
  }

  /** Deletes files only when no remaining record references them (SRS 13.6 / 16). */
  private async removeFilesIfUnreferenced(paths: string[]) {
    for (const p of paths) {
      const refs = await this.repo
        .createQueryBuilder('n')
        .where('CAST(n.images AS CHAR) LIKE :p', { p: `%${escapeLike(JSON.stringify(p))}%` })
        .getCount();
      if (refs === 0) await this.storage.remove(p);
    }
  }

  async removeMany(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) }, select: { id: true, title: true, images: true } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض السجلات غير موجودة');
    await this.repo.delete(unique);
    await this.removeFilesIfUnreferenced(rows.flatMap((r) => r.images ?? []));
    for (const r of rows) {
      await this.audit.log({ category: 'news', action: 'delete', description: `حذف سجل: ${r.title}`, actorId: actor.id, entityType: 'news', entityId: r.id });
    }
    return { deleted: rows.length };
  }
}
