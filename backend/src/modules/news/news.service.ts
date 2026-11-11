import { pdfList, toStringArray } from '../../common/utils/lists';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThanOrEqual, Repository } from 'typeorm';
import {
  Language,
  MAX_IMAGES_PER_RECORD,
  MAX_PDFS_PER_RECORD,
  NewsStatus,
  PERM,
  SPECIAL_CATEGORY_CODES,
  SPECIAL_CATEGORY_CONFIG,
  SpecialCategory,
  createPermissionFor,
  newsPerm,
} from '../../common/constants';
import { CONTENT_CATEGORY_CODES, RESERVED_CATEGORY_CODES } from '../../common/content-categories';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { fixedNewsCategories, fixedNewsCategoryKey, localizeFixedNewsCategory, matchFixedNewsCategory, newsCategoryLabel, NewsMainCategoryKey } from '../../common/news-categories';
import { AuthUser } from '../../common/types';
import { adminPage, paged } from '../../common/utils/pagination';
import { isYmd } from '../../common/utils/dates';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { codeKey, escapeLike, normalizeLabel, sanitizeRichText } from '../../common/utils/text';
import { News } from './news.entity';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { CreateNewsDto, NewsAdminQueryDto, UpdateNewsDto } from './news.dto';
import { onlyRegular } from './news.eligibility';
import { removedChanges } from '../audit/audit-snapshot';
import { parseYoutubeId, youtubeWatchUrl } from '../../common/utils/youtube';

type Action = 'read' | 'update' | 'delete';

const LIST_COLUMNS = [
  'id', 'title', 'subject', 'mainCategory', 'subcategory', 'topics', 'images', 'rating', 'isFeatured',
  'publishAt', 'finishAt', 'status', 'language', 'visibility', 'viewCount', 'createdAt', 'updatedAt', 'createdById',
];

/** 'regular' for ordinary news, otherwise the section code. */
const kindOf = (main: string) => (SPECIAL_CATEGORY_CODES.includes(main) ? main : 'regular');

/** What kinds of content (regular and/or which sections) the user holds `action` for. */
function allowedKinds(perms: Set<string>, action: 'read' | 'update' | 'delete') {
  return {
    regular: perms.has(newsPerm(action, 'regular')),
    sections: SPECIAL_CATEGORY_CODES.filter((c) => perms.has(newsPerm(action, c))),
  };
}

/** Sections whose records carry exactly one picture. */
const SINGLE_IMAGE_SECTIONS: SpecialCategory[] = [SpecialCategory.TEAM, SpecialCategory.COMPANY_OVERVIEW];

@Injectable()
export class NewsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsService.name);
  private publishTimer: NodeJS.Timeout | undefined;

  constructor(
    @InjectRepository(News) private readonly repo: Repository<News>,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.publishDueNews();
    this.publishTimer = setInterval(() => {
      void this.publishDueNews().catch((error: unknown) => {
        this.logger.error('Failed to publish scheduled news', error instanceof Error ? error.stack : String(error));
      });
    }, 30_000);
    this.publishTimer.unref();
  }

  onModuleDestroy() {
    if (this.publishTimer) clearInterval(this.publishTimer);
  }

  /** Runs by itself (no user): scheduled items whose time has come go live, and the audit log says which ones. */
  private async publishDueNews() {
    const due = await this.repo.find({ where: { status: NewsStatus.SCHEDULED, publishAt: LessThanOrEqual(new Date()) }, select: { id: true } });
    if (!due.length) return;
    const ids = due.map((n) => n.id);
    const res = await this.repo.update({ id: In(ids), status: NewsStatus.SCHEDULED }, { status: NewsStatus.PUBLISHED });
    if (res.affected) {
      await this.audit.log({ category: 'news', action: 'auto_publish', description: `نشر تلقائي لـ ${res.affected} عنصر مجدول`, entityType: 'news', details: { ids } });
    }
  }

  present(n: News) {
    const { createdBy, ...rest } = n as any;
    const images = toStringArray(n.images);
    return { ...rest, images, topics: toStringArray(n.topics), imageUrls: images.map((p) => this.storage.url(p)), pdfUrl: n.pdf ? this.storage.url(n.pdf) : null, pdfs: pdfList(n), pdfUrls: pdfList(n).map((p) => this.storage.url(p)), createdByName: createdBy?.fullName };
  }

  // ---------------------------------------------------------------- listing
  private buildAdminQuery(q: NewsAdminQueryDto, actor: AuthUser, withBody = false) {
    const qb = this.repo.createQueryBuilder('n');
    // Only rows of kinds the user may READ: regular news and/or the sections they hold news.read.<section> for.
    const ok = allowedKinds(actor.permissions, 'read');
    if (q.section) {
      const wanted = q.section.toLowerCase() === 'regular' ? 'regular' : codeKey(q.section);
      const allowed = wanted === 'regular' ? ok.regular : ok.sections.includes(wanted);
      if (!allowed) throw new ForbiddenException('ليست لديك صلاحية عرض هذا النوع من المحتوى');
    } else {
      qb.andWhere(
        new Brackets((b) => {
          if (ok.regular) b.where(`n.mainCategory NOT IN (:...allSections)`, { allSections: RESERVED_CATEGORY_CODES });
          else b.where('1 = 0');
          if (ok.sections.length) b.orWhere('n.mainCategory IN (:...okSections)', { okSections: ok.sections });
        }),
      );
    }
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
    if (q.topic) qb.andWhere('CAST(n.topics AS TEXT) ILIKE :topic', { topic: `%${escapeLike(JSON.stringify(normalizeLabel(q.topic)))}%` });
    if (q.from) qb.andWhere('COALESCE(n.publishAt, n.createdAt) >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('COALESCE(n.publishAt, n.createdAt) <= :to', { to: dayEnd(q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(
        new Brackets((b) =>
          b.where('n.title ILIKE :like', { like }).orWhere('n.subject ILIKE :like', { like }).orWhere('n.mainCategory ILIKE :like', { like }).orWhere('n.subcategory ILIKE :like', { like }),
        ),
      );
    }
    applyColumnFilters(qb, q.cf, { title: 'n.title', subject: 'n.subject', mainCategory: 'n.mainCategory', subcategory: 'n.subcategory', topics: 'CAST(n.topics AS TEXT)', publishAt: 'CAST(n.publishAt AS TEXT)', viewCount: 'CAST(n.viewCount AS TEXT)' });
    qb.orderBy('n.id', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC');
    return qb;
  }

  async list(q: NewsAdminQueryDto, actor: AuthUser) {
    const p = adminPage(q);
    const [rows, total] = await this.buildAdminQuery(q, actor).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  listAllForExport(q: NewsAdminQueryDto, actor: AuthUser) {
    return this.buildAdminQuery(q, actor).take(10000).getMany();
  }

  /** Internal: no permission check (used right after create/update, whose own permission was already verified). */
  private async load(id: number) {
    const n = await this.repo.findOne({ where: { id }, relations: { createdBy: true }, select: { createdBy: { id: true, fullName: true } } as any });
    // FAQ, documents, board ... are news rows too, but they are managed from their own screens
    if (!n || CONTENT_CATEGORY_CODES.includes(n.mainCategory)) throw new NotFoundException('السجل غير موجود');
    return n;
  }

  private assertMay(action: Action, main: string, perms: Set<string>) {
    if (!perms.has(newsPerm(action, main))) {
      const what = { read: 'عرض', update: 'تعديل', delete: 'حذف' }[action];
      throw new ForbiddenException(`ليست لديك صلاحية ${what} هذا النوع من المحتوى`);
    }
  }

  async get(id: number, actor: AuthUser) {
    const n = await this.load(id);
    this.assertMay('read', n.mainCategory, actor.permissions);
    return this.present(n);
  }

  /**
   * Dropdown values come from the real DISTINCT values in `news` (SRS 13.2) – there is no categories table.
   * Main category and subcategory are two independent lists: neither is filtered by the other.
   */
  async categories(lang?: Language) {
    // with `lang` (the language of the record being edited) only that language's fixed categories and the categories used by news of that language are listed
    const inLang = (qb: ReturnType<Repository<News>['createQueryBuilder']>) => (lang ? qb.andWhere('n.language = :lang', { lang }) : qb);
    const main = await inLang(
      this.repo.createQueryBuilder('n').select('DISTINCT n.mainCategory', 'v').where('n.mainCategory NOT IN (:...sp)', { sp: RESERVED_CATEGORY_CODES }),
    ).orderBy('v', 'ASC').getRawMany();
    const sub = await inLang(
      this.repo.createQueryBuilder('n').select('DISTINCT n.subcategory', 'v').where('n.subcategory IS NOT NULL').andWhere('n.mainCategory NOT IN (:...sp)', { sp: RESERVED_CATEGORY_CODES }),
    ).orderBy('v', 'ASC').getRawMany();
    // the fixed media-center categories always come first, in the requested language (both languages when none is asked), then whatever else editors already used
    const fixed = lang ? fixedNewsCategories(lang) : [...fixedNewsCategories('ar'), ...fixedNewsCategories('en')];
    const all = [...fixedNewsCategories('ar'), ...fixedNewsCategories('en')].map((x) => x.toLowerCase());
    const others = main.map((r) => r.v as string).filter((v) => !all.includes(String(v).toLowerCase()));
    return { main: [...fixed, ...others], sub: sub.map((r) => r.v), special: SPECIAL_CATEGORY_CODES };
  }

  // ---------------------------------------------------------------- validation helpers
  private async canonical(kind: 'main' | 'sub', value: string): Promise<string | null> {
    // a fixed media-center category is always valid (no "create category" permission needed) and keeps its canonical spelling
    if (kind === 'main') { const fixed = matchFixedNewsCategory(value); if (fixed) return fixed; }
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
    input: { mainCategory?: string; categoryKey?: string; subcategory?: string | null; section?: string },
    perms: Set<string>,
    language: Language,
    existing?: News,
  ): Promise<{ main: string; sub: string | null }> {
    let main: string;
    const pinKey = input.categoryKey as NewsMainCategoryKey | undefined;
    if (pinKey && input.section) throw new BadRequestException('لا يمكن تثبيت فئة خبر في قسم خاص');
    if (!existing) {
      if (input.section) {
        if (input.mainCategory && codeKey(input.mainCategory) !== input.section) throw new BadRequestException('الفئة الرئيسية لا تطابق القسم');
        main = input.section;
      } else {
        // a page that owns one category (categoryKey): the category is that page's, in the language of the record; any other value is refused
        if (pinKey && input.mainCategory && fixedNewsCategoryKey(input.mainCategory) !== pinKey) throw new BadRequestException('هذه الصفحة تضيف أخباراً من فئتها فقط ولا يمكن تغيير الفئة');
        if (!input.mainCategory && !pinKey) throw new BadRequestException('الفئة الرئيسية مطلوبة');
        const norm = pinKey ? newsCategoryLabel(pinKey, language) : normalizeLabel(input.mainCategory!);
        if (RESERVED_CATEGORY_CODES.includes(codeKey(norm))) throw new BadRequestException('هذه القيمة رمز محجوز لقسم خاص ولا تُستخدم في نموذج الأخبار العادية');
        main = await this.regularValue('main', norm, perms);
      }
    } else {
      main = existing.mainCategory;
      if (pinKey) {
        // editing from a page that owns one category: the record must already be of that category and keeps it
        if (fixedNewsCategoryKey(existing.mainCategory) !== pinKey) throw new BadRequestException('هذا الخبر لا يتبع فئة هذه الصفحة');
        if (input.mainCategory && fixedNewsCategoryKey(input.mainCategory) !== pinKey) throw new BadRequestException('لا يمكن تغيير فئة الخبر من هذه الصفحة');
      } else if (input.mainCategory !== undefined) {
        const norm = normalizeLabel(input.mainCategory ?? '');
        if (!norm) throw new BadRequestException('الفئة الرئيسية مطلوبة');
        const special = SPECIAL_CATEGORY_CODES.includes(codeKey(norm));
        const candidate = special ? codeKey(norm) : norm;
        // the same fixed category spelled in the other language is not a change
        const sameFixed = !!fixedNewsCategoryKey(candidate) && fixedNewsCategoryKey(candidate) === fixedNewsCategoryKey(existing.mainCategory);
        if (!sameFixed && candidate.toLowerCase() !== existing.mainCategory.toLowerCase()) {
          if (!perms.has(PERM.NEWS_CATEGORY_CHANGE)) throw new ForbiddenException('ليست لديك صلاحية تغيير الفئة الرئيسية');
          main = special ? candidate : await this.regularValue('main', norm, perms);
        }
      }
    }

    // a fixed category always carries the language of its record (an Arabic label never sits on English news and the other way round)
    if (!SPECIAL_CATEGORY_CODES.includes(main)) main = localizeFixedNewsCategory(main, language);

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

  /** One permission per kind of content: regular news, or one of the special sections. */
  private assertMayCreate(main: string, perms: Set<string>) {
    if (!perms.has(createPermissionFor(main))) throw new ForbiddenException('ليست لديك صلاحية إنشاء هذا النوع من المحتوى');
  }

  private resolvePublishing(
    dto: { status?: NewsStatus; publishAt?: string | null },
    existing: News | undefined,
    perms: Set<string>,
  ): { status: NewsStatus; publishAt: Date | null } {
    const now = new Date();
    const status = dto.status ?? existing?.status ?? NewsStatus.PUBLISHED;
    const providedAt = dto.publishAt !== undefined;
    let publishAt: Date | null = providedAt ? (dto.publishAt ? new Date(dto.publishAt) : null) : existing?.publishAt ?? null;
    if (publishAt && Number.isNaN(publishAt.getTime())) throw new BadRequestException('تاريخ النشر غير صالح');

    const statusChanged = existing ? status !== existing.status : status !== NewsStatus.PUBLISHED;
    const publishAtChanged = providedAt && (
      existing
        ? (publishAt?.getTime() ?? null) !== (existing.publishAt?.getTime() ?? null)
        : dto.publishAt != null
    );
    if ((statusChanged || publishAtChanged) && !perms.has(PERM.NEWS_PUBLISH)) {
      throw new ForbiddenException('ليست لديك صلاحية النشر أو الجدولة');
    }

    if (providedAt || statusChanged || (!existing && status === NewsStatus.PUBLISHED)) {
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

  /** undefined = untouched, null = no video, string = the normalised watch URL. Videos belong to regular news only. */
  private resolveYoutube(given: string | null | undefined, main: string): string | null | undefined {
    if (given === undefined) return undefined;
    if (given === null || !given.trim()) return null;
    if (SPECIAL_CATEGORY_CODES.includes(main)) throw new BadRequestException('فيديو يوتيوب متاح للأخبار العادية فقط');
    const id = parseYoutubeId(given);
    if (!id) throw new BadRequestException('رابط يوتيوب غير صالح');
    return youtubeWatchUrl(id);
  }

  // ---------------------------------------------------------------- create / update / delete
  async create(dto: CreateNewsDto, files: Express.Multer.File[], actor: AuthUser, pdfFiles: Express.Multer.File[] = []) {
    const perms = actor.permissions;
    if (dto.finishAt && !isYmd(dto.finishAt)) throw new BadRequestException('تاريخ النهاية غير صالح');
    if (pdfFiles.length > MAX_PDFS_PER_RECORD) throw new BadRequestException('عدد ملفات PDF كبير جداً');
    if ((files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const { main, sub } = await this.resolveCategories(dto, perms, dto.language ?? Language.AR);
    this.assertMayCreate(main, perms);
    if (SINGLE_IMAGE_SECTIONS.includes(main as SpecialCategory) && (files?.length ?? 0) > 1) throw new BadRequestException('هذا القسم يقبل صورة واحدة فقط');
    const pub = this.resolvePublishing(dto, undefined, perms);
    if (dto.isFeatured && !perms.has(PERM.NEWS_FEATURE)) throw new ForbiddenException('ليست لديك صلاحية تمييز الأخبار');
    const rating = this.resolveRating(main, dto.rating);
    const youtubeUrl = this.resolveYoutube(dto.youtubeUrl, main) ?? null;

    if (pdfFiles.length && SPECIAL_CATEGORY_CODES.includes(main)) throw new BadRequestException('ملف PDF متاح للأخبار العادية فقط');

    const imagePaths = await this.storage.saveImages(files ?? [], 'news'); // validated first, rolled back on failure
    const pdfPaths: string[] = [];
    try {
      for (const f of pdfFiles) pdfPaths.push(await this.storage.savePdf(f, 'news'));
    } catch (e) {
      await this.storage.removeMany([...imagePaths, ...pdfPaths]);
      throw e;
    }
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
          pdf: pdfPaths[0] ?? null,
          pdfs: pdfPaths,
          youtubeUrl,
          rating,
          isFeatured: dto.isFeatured ?? false,
          publishAt: pub.publishAt,
          finishAt: dto.finishAt ?? null,
          status: pub.status,
          language: dto.language ?? Language.AR,
          visibility: dto.visibility,
          createdById: actor.id,
        }),
      );
      await this.audit.log({ category: 'news', action: 'create', description: `إنشاء سجل: ${saved.title}`, actorId: actor.id, entityType: 'news', entityId: saved.id, details: { mainCategory: main, status: pub.status } });
      return this.present(await this.load(saved.id));
    } catch (e) {
      await this.storage.removeMany([...imagePaths, ...pdfPaths]);
      throw e;
    }
  }

  async update(id: number, dto: UpdateNewsDto, files: Express.Multer.File[], actor: AuthUser, pdfFiles: Express.Multer.File[] = []) {
    const n = await this.repo.findOne({ where: { id } });
    if (!n || CONTENT_CATEGORY_CODES.includes(n.mainCategory)) throw new NotFoundException('السجل غير موجود');
    if (dto.finishAt && !isYmd(dto.finishAt)) throw new BadRequestException('تاريخ النهاية غير صالح');
    const perms = actor.permissions;
    this.assertMay('update', n.mainCategory, perms); // update permission of the record's CURRENT kind

    const { main, sub } = await this.resolveCategories(dto, perms, dto.language ?? n.language, n);
    // moving a record into another kind of content (regular ↔ a section, or section → section) counts as creating it there
    if (kindOf(main) !== kindOf(n.mainCategory)) this.assertMayCreate(main, perms);
    const pub = this.resolvePublishing(dto, n, perms);
    // re-sending the current value is harmless; only an actual change needs the permission
    if (dto.isFeatured !== undefined && dto.isFeatured !== n.isFeatured && !perms.has(PERM.NEWS_FEATURE)) throw new ForbiddenException('ليست لديك صلاحية تمييز الأخبار');
    const rating = this.resolveRating(main, dto.rating, n);
    const youtube = this.resolveYoutube(dto.youtubeUrl, main);

    // image reconciliation: keep ∖ existing is rejected, existing ∖ keep is removed AFTER the save succeeds
    const existingImgs = n.images ?? [];
    const keep = dto.keepImages ?? existingImgs;
    if (keep.some((p) => !existingImgs.includes(p))) throw new BadRequestException('مسار صورة غير موجود في السجل');
    const removed = existingImgs.filter((p) => !keep.includes(p));
    if (keep.length + (files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    if (SINGLE_IMAGE_SECTIONS.includes(main as SpecialCategory) && keep.length + (files?.length ?? 0) > 1) throw new BadRequestException('هذا القسم يقبل صورة واحدة فقط');
    if (pdfFiles.length && SPECIAL_CATEGORY_CODES.includes(main)) throw new BadRequestException('ملف PDF متاح للأخبار العادية فقط');
    // PDF reconciliation (same idea as the images): keepPdfs ⊆ existing, new files are appended, the dropped ones are deleted AFTER the save
    const existingPdfs = pdfList(n);
    const keepPdfs = SPECIAL_CATEGORY_CODES.includes(main) || dto.removePdf ? [] : dto.keepPdfs ?? existingPdfs;
    if (keepPdfs.some((p) => !existingPdfs.includes(p))) throw new BadRequestException('مسار ملف PDF غير موجود في السجل');
    if (keepPdfs.length + pdfFiles.length > MAX_PDFS_PER_RECORD) throw new BadRequestException('عدد ملفات PDF كبير جداً');
    const removedPdfs = existingPdfs.filter((p) => !keepPdfs.includes(p));
    const added = await this.storage.saveImages(files ?? [], 'news');
    const newPdfs: string[] = [];
    try {
      for (const f of pdfFiles) newPdfs.push(await this.storage.savePdf(f, 'news'));
    } catch (e) {
      await this.storage.removeMany([...added, ...newPdfs]);
      throw e;
    }
    const nextPdfs = [...keepPdfs, ...newPdfs];

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
        ...(dto.finishAt !== undefined && { finishAt: dto.finishAt }),
        images: [...keep, ...added],
        pdf: nextPdfs[0] ?? null,
        pdfs: nextPdfs,
        youtubeUrl: SPECIAL_CATEGORY_CODES.includes(main) ? null : youtube !== undefined ? youtube : n.youtubeUrl,
      });
      await this.repo.save(n);
    } catch (e) {
      await this.storage.removeMany([...added, ...newPdfs]); // change cancelled completely
      throw e;
    }
    await this.removeFilesIfUnreferenced(removed);
    await this.storage.removeMany(removedPdfs);
    await this.audit.log({ category: 'news', action: 'update', description: `تعديل سجل: ${n.title}`, actorId: actor.id, entityType: 'news', entityId: id, details: { status: n.status, removedImages: removed.length, addedImages: added.length } });
    return this.present(await this.load(id));
  }

  /** Deletes files only when no remaining record references them (SRS 13.6 / 16). */
  private async removeFilesIfUnreferenced(paths: string[]) {
    for (const p of paths) {
      const refs = await this.repo
        .createQueryBuilder('n')
        .where('CAST(n.images AS TEXT) ILIKE :p', { p: `%${escapeLike(JSON.stringify(p))}%` })
        .getCount();
      if (refs === 0) await this.storage.remove(p);
    }
  }

  async removeMany(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) }, select: { id: true, title: true, subject: true, images: true, pdf: true, pdfs: true, mainCategory: true, subcategory: true, status: true, language: true, visibility: true, publishAt: true } });
    if (rows.length !== unique.length || rows.some((r) => CONTENT_CATEGORY_CODES.includes(r.mainCategory))) throw new NotFoundException('بعض السجلات غير موجودة');
    // every record must be of a kind the user may delete; otherwise nothing is deleted
    for (const r of rows) this.assertMay('delete', r.mainCategory, actor.permissions);
    await this.repo.delete(unique);
    await this.removeFilesIfUnreferenced(rows.flatMap((r) => r.images ?? []));
    await this.storage.removeMany(rows.flatMap((r) => pdfList(r))); // a PDF belongs to exactly one record
    for (const r of rows) {
      await this.audit.log({ category: 'news', action: 'delete', description: `حذف سجل: ${r.title}`, actorId: actor.id, entityType: 'news', entityId: r.id, changes: removedChanges('news', [r]) });
    }
    return { deleted: rows.length };
  }
}
