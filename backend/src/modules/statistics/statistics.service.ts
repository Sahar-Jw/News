import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Language } from '../../common/constants';
import { CC } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { ContentStore, Rec, isActive, s, sortOf } from '../content/content.store';
import { by, filterByCf, matches, pageRows } from '../content/mem';
import { CreateStatisticDto, PublicStatisticsQueryDto, StatisticsAdminQueryDto, UpdateStatisticDto } from './statistics.dto';

// ---- DB-BACKED NUMBERS: switched off for now (the code is kept below, commented, together with statistics.metrics.ts) ----
// To switch them on again: uncomment the imports and the block marked "DB-BACKED NUMBERS" in this file, the `metric` fields in
// statistics.dto.ts and the `metrics` route in statistics.controller.ts, and the matching parts of statistics-admin.tsx.
// import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
// import { DataSource, Repository } from 'typeorm';
// import { News } from '../news/news.entity';
// import { applyEligibility, onlyRegular } from '../news/news.eligibility';
// import { METRICS, METRIC_KEYS, MetricCtx } from './statistics.metrics';
// const METRICS_TTL = Number(process.env.STATISTICS_CACHE_TTL_MS ?? 60_000);
// const METRIC_PARALLEL = 3; // how many counting queries may run at the same time (the database pool is shared with the whole site)
// const BY_KEY = new Map(METRICS.map((d) => [d.key, d]));

const MAX_ON_HOME = 5;

/**
 * The statistics band of the home page. Each statistic is a content record (main category STATISTIC): the Arabic and English titles,
 * a value typed by hand, and an optional prefix / suffix ("+", "member"...). Nothing is read from the database for now.
 */
@Injectable()
export class StatisticsService {
  constructor(
    private readonly store: ContentStore,
    private readonly audit: AuditService,
    // DB-BACKED NUMBERS: @InjectDataSource() private readonly ds: DataSource,
    // DB-BACKED NUMBERS: @InjectRepository(News) private readonly news: Repository<News>,
  ) {}

  // ================================================================== DB-BACKED NUMBERS (disabled for now) ==================================================================
  // /** one counted number per key, remembered for a minute; the promise itself is kept, so requests arriving together share one query */
  // private cache = new Map<string, { at: number; v: Promise<number | null> }>();
  // private running = 0;
  // private waiting: (() => void)[] = [];
  //
  // // ------------------------------------------------------------------ real numbers
  // private ctx(): MetricCtx {
  //   return {
  //     cc: (codes, where) => {
  //       const list = Array.isArray(codes) ? codes : [codes];
  //       const qb = this.news.createQueryBuilder('n').where('n.mainCategory IN (:...codes)', { codes: list }).andWhere(`n.extra ->> 'isActive' IS DISTINCT FROM 'false'`);
  //       if (where) qb.andWhere(where.sql, where.params);
  //       return qb.getCount();
  //     },
  //     sql: async (q) => Number(Object.values((await this.ds.query(q))[0] ?? {})[0] ?? 0),
  //     news: async (lang) => {
  //       const qb = this.news.createQueryBuilder('n');
  //       applyEligibility(qb, 'n', { lang: lang as Language | undefined, authenticated: false });
  //       onlyRegular(qb, 'n');
  //       return qb.getCount();
  //     },
  //   };
  // }
  //
  // private async limited<T>(fn: () => Promise<T>): Promise<T> {
  //   if (this.running >= METRIC_PARALLEL) await new Promise<void>((resolve) => this.waiting.push(resolve));
  //   this.running++;
  //   try { return await fn(); } finally { this.running--; this.waiting.shift()?.(); }
  // }
  //
  // private one(key: string): Promise<number | null> {
  //   const hit = this.cache.get(key);
  //   if (hit && Date.now() - hit.at < METRICS_TTL) return hit.v;
  //   const v = this.limited(() => BY_KEY.get(key)!.value(this.ctx()))
  //     .then((n) => (Number.isFinite(n) ? n : null))
  //     .catch(() => { this.cache.delete(key); return null; }); // a failing one is null (never an error for the page) and is tried again next time
  //   this.cache.set(key, { at: Date.now(), v });
  //   return v;
  // }
  //
  // /** only the numbers asked for (a failing one is null); the page never counts anything it does not show */
  // async metricValues(keys: Iterable<string>): Promise<Record<string, number | null>> {
  //   const list = [...new Set([...keys].filter((k) => BY_KEY.has(k)))];
  //   const values = await Promise.all(list.map((k) => this.one(k)));
  //   return Object.fromEntries(list.map((k, i) => [k, values[i]]));
  // }
  //
  // private keysOf(rows: Rec[]) {
  //   return rows.filter((r) => !s(r.x.value).trim()).map((r) => s(r.x.metric)).filter(Boolean);
  // }
  //
  // /** the catalog for the "choose a real number" list, with the current value of each */
  // async catalog() {
  //   const values = await this.metricValues(METRICS.map((d) => d.key));
  //   return METRICS.map((d) => ({ key: d.key, groupAr: d.groupAr, groupEn: d.groupEn, ar: d.ar, en: d.en, value: values[d.key] ?? null }));
  // }
  //
  // private async check(metric: string | null | undefined) {
  //   if (metric && !METRIC_KEYS.has(metric)) throw new BadRequestException('الرقم المختار غير معروف');
  // }
  // ================================================================== end of DB-BACKED NUMBERS ==================================================================

  // ------------------------------------------------------------------ the records
  /** what the page shows: prefix + the typed value + suffix (nothing when no value was typed) */
  private shown(r: Rec, en: boolean): string | null {
    const raw = s(r.x.value).trim();
    if (!raw) return null;
    const suffix = (en ? s(r.x.suffixEn) || s(r.x.suffixAr) : s(r.x.suffixAr) || s(r.x.suffixEn)).trim();
    return `${s(r.x.prefix)}${raw}${suffix ? ` ${suffix}` : ''}`;
  }

  private view(r: Rec) {
    return {
      id: r.id, titleAr: r.title, titleEn: s(r.x.titleEn), value: s(r.x.value).trim(), prefix: s(r.x.prefix), suffixAr: s(r.x.suffixAr), suffixEn: s(r.x.suffixEn),
      sortOrder: sortOf(r), isActive: isActive(r),
      /** what the page shows now (Arabic) */
      shownValue: this.shown(r, false),
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }

  async list(q: StatisticsAdminQueryDto) {
    let rows = (await this.store.list(CC.STATISTIC)).map((r) => this.view(r));
    if (q.q) rows = rows.filter((x) => matches([x.titleAr, x.titleEn, x.value], q.q!));
    rows = filterByCf(rows, q.cf, { titleAr: (x) => [x.titleAr], titleEn: (x) => [x.titleEn] });
    rows.sort(by((x) => x.sortOrder, (x) => x.id));
    return pageRows(rows, q, (x) => x);
  }

  async adminOne(id: number) {
    const r = await this.store.get(id, CC.STATISTIC);
    if (!r) throw new NotFoundException('الإحصائية غير موجودة');
    return this.view(r);
  }

  async create(dto: CreateStatisticDto, actor: AuthUser) {
    if (!dto.value?.trim()) throw new BadRequestException('اكتب قيمة الإحصائية');
    const r = await this.store.create(CC.STATISTIC, {
      title: dto.titleAr.trim(),
      x: {
        titleEn: dto.titleEn?.trim() || null, value: dto.value.trim(), metric: null, prefix: dto.prefix?.trim() || null,
        suffixAr: dto.suffixAr?.trim() || null, suffixEn: dto.suffixEn?.trim() || null, sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({ category: 'statistics', action: 'create', description: `إضافة إحصائية: ${r.title}`, actorId: actor.id, entityType: 'statistics', entityId: r.id });
    return this.view(r);
  }

  async update(id: number, dto: UpdateStatisticDto, actor: AuthUser) {
    const cur = await this.store.get(id, CC.STATISTIC);
    if (!cur) throw new NotFoundException('الإحصائية غير موجودة');
    if (dto.value !== undefined && !dto.value?.trim()) throw new BadRequestException('اكتب قيمة الإحصائية');
    const clean = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
    const r = await this.store.update(id, {
      title: dto.titleAr?.trim(),
      x: {
        titleEn: clean(dto.titleEn), value: clean(dto.value), metric: null, prefix: clean(dto.prefix),
        suffixAr: clean(dto.suffixAr), suffixEn: clean(dto.suffixEn), sortOrder: dto.sortOrder, isActive: dto.isActive,
      },
    });
    await this.audit.log({ category: 'statistics', action: 'update', description: `تعديل إحصائية: ${r!.title}`, actorId: actor.id, entityType: 'statistics', entityId: id });
    return this.view(r!);
  }

  remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(CC.STATISTIC);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض الإحصائيات غير موجودة'); // nothing is deleted
    await this.store.remove(unique);
    await this.audit.log({ category: 'statistics', action: 'delete', description: `حذف ${rows.length} إحصائية`, actorId: actor.id, entityType: 'statistics', details: { ids: unique }, changes: removedChanges('statistics', rows.map((r) => this.view(r))) });
    return { deleted: rows.length };
  }

  // ------------------------------------------------------------------ public
  /**
   * The figures of the home page (at most five, in their order): active statistics that have a typed value.
   * `null` = none were defined here, so the home page keeps showing the older statistics news items.
   */
  async forHome(lang: Language | undefined) {
    const rows = (await this.store.list(CC.STATISTIC)).filter(isActive);
    if (!rows.length) return null;
    const en = lang === Language.EN;
    return rows
      .sort(by((r) => sortOf(r), (r) => r.id))
      .map((r) => ({ id: r.id, title: (en && s(r.x.titleEn)) || r.title, excerpt: this.shown(r, en) }))
      .filter((x): x is { id: number; title: string; excerpt: string } => !!x.excerpt)
      .slice(0, MAX_ON_HOME);
  }

  async publicList(q: PublicStatisticsQueryDto) {
    return (await this.forHome(q.lang === 'en' ? Language.EN : Language.AR)) ?? [];
  }
}
