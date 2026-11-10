import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { MAX_IMAGES_PER_RECORD } from '../../common/constants';
import { CC, RESERVED_CATEGORY_CODES } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { adminPage, paged, publicPage } from '../../common/utils/pagination';
import { isYmd, todayYmd } from '../../common/utils/dates';
import { escapeLike } from '../../common/utils/text';
import { parseYoutubeId, youtubeWatchUrl } from '../../common/utils/youtube';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { ContentLinksService } from '../content-links/content-links.service';
import { ContentStore, Rec, pick } from '../content/content.store';
import { News } from '../news/news.entity';
import { applyEligibility } from '../news/news.eligibility';
import { by, filterByCf, matches } from '../content/mem';
import { CreateOccasionDto, OccasionsAdminQueryDto, PublicOccasionsQueryDto, UpdateOccasionDto } from './occasions.dto';
import { removedChanges } from '../audit/audit-snapshot';

/** 'agenda' = what is still to come or happening now (upcoming + current). */
export type OccasionScope = 'all' | 'upcoming' | 'current' | 'previous' | 'exhibitions' | 'agenda';

type Coverage = { title: string; url: string; source: string };
const DETAIL_TEXT = ['descriptionAr', 'descriptionEn', 'locationAr', 'locationEn', 'sectorAr', 'sectorEn', 'organizerAr', 'organizerEn', 'startTime', 'endTime', 'audienceAr', 'audienceEn', 'registrationUrl', 'registrationNoteAr', 'registrationNoteEn'] as const;

@Injectable()
export class OccasionsService {
  constructor(
    private readonly store: ContentStore,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
    private readonly links: ContentLinksService,
    @InjectRepository(News) private readonly news: Repository<News>,
  ) {}

  private text(r: Rec, key: string) {
    return String(r.x[key] ?? '');
  }

  private videosOf(r: Rec): string[] {
    return Array.isArray(r.x.videos) ? (r.x.videos as unknown[]).map(String) : [];
  }

  private coverageOf(r: Rec): Coverage[] {
    return Array.isArray(r.x.coverage) ? (r.x.coverage as Coverage[]) : [];
  }

  private parentOf(r: Rec): number | null {
    return r.x.parentId ? Number(r.x.parentId) : null;
  }

  /** The new optional fields of a create/update body as `news.extra` keys (undefined = leave alone). */
  private detailX(dto: CreateOccasionDto | UpdateOccasionDto, self?: number) {
    const x: Record<string, unknown> = {};
    for (const k of DETAIL_TEXT) if (dto[k] !== undefined) x[k] = dto[k]!.trim();
    if (dto.participation !== undefined) x.participation = dto.participation;
    if (dto.videos !== undefined) {
      x.videos = dto.videos.map((u) => {
        const id = parseYoutubeId(u);
        if (!id) throw new BadRequestException('رابط يوتيوب غير صالح');
        return youtubeWatchUrl(id);
      });
    }
    if (dto.coverage !== undefined) x.coverage = dto.coverage;
    if (dto.parentId !== undefined) {
      if (dto.parentId && dto.parentId === self) throw new BadRequestException('لا يمكن ربط الحدث بنفسه');
      x.parentId = dto.parentId || null;
    }
    return x;
  }

  private async assertParent(parentId: number | null | undefined) {
    if (!parentId) return;
    const p = await this.store.get(parentId, CC.OCCASION);
    if (!p || this.eventType(p) !== 'exhibition') throw new BadRequestException('المعرض المرتبط غير موجود');
  }

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
      descriptionAr: this.text(r, 'descriptionAr'), descriptionEn: this.text(r, 'descriptionEn'),
      locationAr: this.text(r, 'locationAr'), locationEn: this.text(r, 'locationEn'),
      sectorAr: this.text(r, 'sectorAr'), sectorEn: this.text(r, 'sectorEn'),
      organizerAr: this.text(r, 'organizerAr'), organizerEn: this.text(r, 'organizerEn'),
      participation: this.text(r, 'participation'),
      startTime: this.text(r, 'startTime'), endTime: this.text(r, 'endTime'),
      audienceAr: this.text(r, 'audienceAr'), audienceEn: this.text(r, 'audienceEn'),
      registrationUrl: this.text(r, 'registrationUrl'), registrationNoteAr: this.text(r, 'registrationNoteAr'), registrationNoteEn: this.text(r, 'registrationNoteEn'),
      parentId: this.parentOf(r),
      videos: this.videosOf(r),
      coverage: this.coverageOf(r),
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
    if (q.q) rows = rows.filter((r) => matches([r.title, r.x.titleEn, this.eventDate(r), r.finishAt, r.x.sectorAr, r.x.sectorEn, r.x.organizerAr, r.x.organizerEn], q.q!));
    rows = filterByCf<Rec>(rows, q.cf, {
      titleAr: (r) => [r.title],
      titleEn: (r) => [r.x.titleEn],
      eventDate: (r) => [this.eventDate(r)],
      finishDate: (r) => [r.finishAt],
      type: (r) => [this.eventType(r)],
      sector: (r) => [r.x.sectorAr, r.x.sectorEn],
      organizer: (r) => [r.x.organizerAr, r.x.organizerEn],
    });
    if (q.from) rows = rows.filter((r) => (r.finishAt ?? this.eventDate(r)) >= q.from!.slice(0, 10));
    if (q.to) rows = rows.filter((r) => this.eventDate(r) <= q.to!.slice(0, 10));
    const effective = scope === 'all' && q.status ? q.status : scope;
    if (effective === 'upcoming' || effective === 'current' || effective === 'previous') rows = rows.filter((r) => this.statusOf(r, today) === effective);
    if (effective === 'exhibitions') rows = rows.filter((r) => this.eventType(r) === 'exhibition');
    if (q.type) rows = rows.filter((r) => this.eventType(r) === q.type);
    if (q.participation) rows = rows.filter((r) => this.text(r, 'participation') === q.participation);
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

  /** a one-day event cannot end before it starts */
  private assertTimes(start: string, finish: string, from?: string, to?: string) {
    if (start === finish && from && to && to < from) throw new BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية');
  }

  async create(dto: CreateOccasionDto, files: Express.Multer.File[], actor: AuthUser) {
    this.assertDates(dto.eventDate, dto.finishDate);
    this.assertTimes(dto.eventDate, dto.finishDate, dto.startTime, dto.endTime);
    if ((files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const detail = this.detailX(dto);
    await this.assertParent(detail.parentId as number | null | undefined);
    const paths = await this.storage.saveImages(files ?? [], 'occasions');
    try {
      const saved = await this.store.create(CC.OCCASION, {
        title: dto.titleAr.trim(),
        images: paths,
        finishAt: dto.finishDate,
        x: { titleEn: dto.titleEn.trim(), eventDate: dto.eventDate, eventType: dto.type ?? 'occasion', isActive: true, ...detail },
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
    this.assertTimes(start, finish, dto.startTime ?? this.text(current, 'startTime'), dto.endTime ?? this.text(current, 'endTime'));
    if ((files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const existing = current.images ?? [];
    const keep = dto.keepImages ?? existing;
    if (keep.some((p) => !existing.includes(p))) throw new BadRequestException('مسار صورة غير موجود في السجل');
    if (keep.length + (files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const removed = existing.filter((p) => !keep.includes(p));
    const detail = this.detailX(dto, id);
    await this.assertParent(detail.parentId as number | null | undefined);
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
          ...detail,
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
    await this.links.removeAllOf('occasion', unique);
    await this.storage.removeMany(rows.flatMap((r) => r.images ?? []));
    await this.audit.log({ category: 'occasions', action: 'delete', description: `حذف ${rows.length} مناسبة`, actorId: actor.id, entityType: 'news', details: { ids: unique }, changes: removedChanges('news', rows.map((r) => this.present(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- admin: news attached to an event
  private async mustFind(id: number) {
    const r = await this.store.get(id, CC.OCCASION);
    if (!r) throw new NotFoundException('الحدث غير موجود');
    return r;
  }

  async linkedNews(id: number) {
    await this.mustFind(id);
    const links = await this.links.linksOf('occasion', id);
    if (!links.length) return [];
    const kinds = new Map(links.map((l) => [l.newsId, l.kind ?? 'news']));
    const rows = await this.news.find({ where: { id: In(links.map((l) => l.newsId)) }, select: ['id', 'title', 'publishAt'], order: { publishAt: 'DESC' } });
    return rows.map((n) => ({ id: n.id, title: n.title, publishAt: n.publishAt, kind: kinds.get(Number(n.id)) ?? 'news' }));
  }

  /** Find news by title to attach (already attached ones are left out). */
  async searchNews(id: number, q: string) {
    await this.mustFind(id);
    const linked = await this.links.newsIdsOf('occasion', id);
    const qb = this.news.createQueryBuilder('n').select(['n.id', 'n.title', 'n.publishAt']).orderBy('n.publishAt', 'DESC', 'NULLS LAST').addOrderBy('n.id', 'DESC').take(10);
    qb.andWhere('n.mainCategory NOT IN (:...res)', { res: RESERVED_CATEGORY_CODES });
    if (q.trim()) qb.andWhere('n.title ILIKE :like', { like: `%${escapeLike(q.trim())}%` });
    if (linked.length) qb.andWhere('n.id NOT IN (:...linked)', { linked });
    return (await qb.getMany()).map((n) => ({ id: n.id, title: n.title, publishAt: n.publishAt }));
  }

  async linkNews(id: number, newsIds: number[], kind: string | undefined, actor: AuthUser) {
    const r = await this.mustFind(id);
    const found = await this.news.find({ where: { id: In(newsIds), mainCategory: Not(In(RESERVED_CATEGORY_CODES)) }, select: ['id'] });
    await this.links.link('occasion', id, found.map((n) => Number(n.id)), kind ?? 'news');
    await this.audit.log({ category: 'occasions', action: 'update', description: `ربط أخبار بالحدث: ${r.title}`, actorId: actor.id, entityType: 'news', entityId: id, details: { newsIds, kind } });
    return { linked: found.length };
  }

  async unlinkNews(id: number, newsIds: number[], actor: AuthUser) {
    const r = await this.mustFind(id);
    await this.links.unlink('occasion', id, newsIds);
    await this.audit.log({ category: 'occasions', action: 'update', description: `فك ربط أخبار عن الحدث: ${r.title}`, actorId: actor.id, entityType: 'news', entityId: id, details: { newsIds } });
    return { unlinked: newsIds.length };
  }

  // ---------------------------------------------------------------- public
  private publicCard(r: Rec, lang: string) {
    const en = lang === 'en';
    const images = r.images ?? [];
    const eventDate = this.eventDate(r);
    return {
      id: r.id,
      title: pick(r.title, r.x.titleEn, en),
      date: eventDate,
      finishDate: r.finishAt ?? eventDate,
      type: this.eventType(r),
      status: this.statusOf(r),
      isUpcoming: this.statusOf(r) === 'upcoming',
      sector: pick(r.x.sectorAr, r.x.sectorEn, en),
      organizer: pick(r.x.organizerAr, r.x.organizerEn, en),
      location: pick(r.x.locationAr, r.x.locationEn, en),
      participation: this.text(r, 'participation'),
      startTime: this.text(r, 'startTime'),
      endTime: this.text(r, 'endTime'),
      audience: pick(r.x.audienceAr, r.x.audienceEn, en),
      registrationUrl: this.text(r, 'registrationUrl'),
      registrationNote: pick(r.x.registrationNoteAr, r.x.registrationNoteEn, en),
      images: images.map((p) => this.storage.url(p)),
    };
  }

  private publicRows(q: { type?: string; sector?: string; organizer?: string; participation?: string; year?: string; q?: string }, rows: Rec[]) {
    const same = (a: unknown, b: unknown, v: string) => [a, b].some((x) => String(x ?? '').trim().toLowerCase() === v.trim().toLowerCase());
    if (q.type) rows = rows.filter((r) => this.eventType(r) === q.type);
    if (q.sector) rows = rows.filter((r) => same(r.x.sectorAr, r.x.sectorEn, q.sector!));
    if (q.organizer) rows = rows.filter((r) => same(r.x.organizerAr, r.x.organizerEn, q.organizer!));
    if (q.participation) rows = rows.filter((r) => this.text(r, 'participation') === q.participation);
    if (q.year) rows = rows.filter((r) => this.eventDate(r).slice(0, 4) <= q.year! && (r.finishAt ?? this.eventDate(r)).slice(0, 4) >= q.year!);
    if (q.q) rows = rows.filter((r) => matches([r.title, r.x.titleEn, r.x.sectorAr, r.x.sectorEn, r.x.organizerAr, r.x.organizerEn, r.x.locationAr, r.x.locationEn], q.q!));
    return rows;
  }

  async publicList(q: PublicOccasionsQueryDto) {
    const today = todayYmd();
    const scope = (q.scope as OccasionScope) ?? 'upcoming';
    let rows = await this.all();
    if (scope === 'upcoming' || scope === 'current' || scope === 'previous') rows = rows.filter((r) => this.statusOf(r, today) === scope);
    if (scope === 'agenda') rows = rows.filter((r) => this.statusOf(r, today) !== 'previous');
    if (scope === 'exhibitions') rows = rows.filter((r) => this.eventType(r) === 'exhibition');
    rows = this.publicRows(q, rows);
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

  /** Values for the filter lists of the public page (sectors, organizers, years), for one type. */
  async facets(type: string | undefined, lang: string) {
    const en = lang === 'en';
    const rows = (await this.all()).filter((r) => !type || this.eventType(r) === type);
    const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, lang));
    const years = new Set<string>();
    for (const r of rows) for (let y = Number(this.eventDate(r).slice(0, 4)); y <= Number((r.finishAt ?? this.eventDate(r)).slice(0, 4)); y++) years.add(String(y));
    return {
      sectors: uniq(rows.map((r) => pick(r.x.sectorAr, r.x.sectorEn, en))),
      organizers: uniq(rows.map((r) => pick(r.x.organizerAr, r.x.organizerEn, en))),
      years: [...years].sort().reverse(),
    };
  }

  async publicOne(id: number, lang = 'ar') {
    const r = await this.store.get(id, CC.OCCASION);
    if (!r || r.x.isActive === false) throw new NotFoundException('المناسبة غير موجودة');
    const en = lang === 'en';
    const all = await this.all();
    const parent = this.parentOf(r) ? all.find((x) => x.id === this.parentOf(r)) : undefined;
    const related = all.filter((x) => this.parentOf(x) === id).sort(by<Rec>((x) => this.eventDate(x))).map((x) => this.publicCard(x, lang));
    const links = await this.links.linksOf('occasion', id);
    let news: unknown[] = [];
    if (links.length) {
      const kinds = new Map(links.map((l) => [l.newsId, l.kind ?? 'news']));
      const qb = this.news.createQueryBuilder('n').select(['n.id', 'n.title', 'n.excerpt', 'n.images', 'n.publishAt']).where('n.id IN (:...ids)', { ids: links.map((l) => l.newsId) });
      applyEligibility(qb, 'n', { lang: en ? 'en' : 'ar', authenticated: false });
      qb.orderBy('n.publishAt', 'DESC').addOrderBy('n.id', 'DESC').take(60);
      news = (await qb.getMany()).map((n) => ({ id: n.id, title: n.title, excerpt: n.excerpt ?? '', image: this.storage.url((n.images ?? [])[0] ?? null), publishAt: n.publishAt, kind: kinds.get(Number(n.id)) ?? 'news' }));
    }
    return {
      ...this.publicCard(r, lang),
      description: pick(r.x.descriptionAr, r.x.descriptionEn, en),
      videos: this.videosOf(r).map((u) => parseYoutubeId(u)).filter((v): v is string => !!v),
      coverage: this.coverageOf(r),
      parent: parent ? { id: parent.id, title: pick(parent.title, parent.x.titleEn, en) } : null,
      related,
      news,
    };
  }
}
