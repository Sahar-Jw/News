import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Language } from '../../common/constants';
import { CC } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { ContentStore, Rec, isActive, s, sortOf } from '../content/content.store';
import { by, filterByCf, matches, pageRows } from '../content/mem';
import { News } from '../news/news.entity';
import { applyEligibility, onlyRegular } from '../news/news.eligibility';
import { CreateStatisticDto, PublicStatisticsQueryDto, StatisticsAdminQueryDto, UpdateStatisticDto } from './statistics.dto';
import { METRICS, METRIC_KEYS, MetricCtx } from './statistics.metrics';

const METRICS_TTL = Number(process.env.STATISTICS_CACHE_TTL_MS ?? 60_000);
/** how many counting queries may run at the same time (the database pool is shared with the whole site) */
const METRIC_PARALLEL = 3;
const MAX_ON_HOME = 5;
const BY_KEY = new Map(METRICS.map((d) => [d.key, d]));

/**
 * The statistics band of the home page. Each statistic is a content record (main category STATISTIC): the Arabic and English titles,
 * a value typed by hand OR the key of a real number counted from the database, and an optional prefix / suffix ("+", "member"...).
 * A hand-typed value always wins; with none, the chosen real number is shown. Real numbers are cached for a minute.
 */
@Injectable()
export class StatisticsService {
  /** one counted number per key, remembered for a minute; the promise itself is kept, so requests arriving together share one query */
  private cache = new Map<string, { at: number; v: Promise<number | null> }>();
  private running = 0;
  private waiting: (() => void)[] = [];

  constructor(
    private readonly store: ContentStore,
    private readonly audit: AuditService,
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(News) private readonly news: Repository<News>,
  ) {}

  // ------------------------------------------------------------------ real numbers
  private ctx(): MetricCtx {
    return {
      cc: (codes, where) => {
        const list = Array.isArray(codes) ? codes : [codes];
        const qb = this.news.createQueryBuilder('n').where('n.mainCategory IN (:...codes)', { codes: list }).andWhere(`n.extra ->> 'isActive' IS DISTINCT FROM 'false'`);
        if (where) qb.andWhere(where.sql, where.params);
        return qb.getCount();
      },
      sql: async (q) => Number(Object.values((await this.ds.query(q))[0] ?? {})[0] ?? 0),
      news: async (lang) => {
        const qb = this.news.createQueryBuilder('n');
        applyEligibility(qb, 'n', { lang: lang as Language | undefined, authenticated: false });
        onlyRegular(qb, 'n');
        return qb.getCount();
      },
    };
  }

  private async limited<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running >= METRIC_PARALLEL) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.running++;
    try { return await fn(); } finally { this.running--; this.waiting.shift()?.(); }
  }

  private one(key: string): Promise<number | null> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < METRICS_TTL) return hit.v;
    const v = this.limited(() => BY_KEY.get(key)!.value(this.ctx()))
      .then((n) => (Number.isFinite(n) ? n : null))
      .catch(() => { this.cache.delete(key); return null; }); // a failing one is null (never an error for the page) and is tried again next time
    this.cache.set(key, { at: Date.now(), v });
    return v;
  }

  /** only the numbers asked for (a failing one is null); the page never counts anything it does not show */
  async metricValues(keys: Iterable<string>): Promise<Record<string, number | null>> {
    const list = [...new Set([...keys].filter((k) => BY_KEY.has(k)))];
    const values = await Promise.all(list.map((k) => this.one(k)));
    return Object.fromEntries(list.map((k, i) => [k, values[i]]));
  }

  private keysOf(rows: Rec[]) {
    return rows.filter((r) => !s(r.x.value).trim()).map((r) => s(r.x.metric)).filter(Boolean);
  }

  /** the catalog for the "choose a real number" list, with the current value of each */
  async catalog() {
    const values = await this.metricValues(METRICS.map((d) => d.key));
    return METRICS.map((d) => ({ key: d.key, groupAr: d.groupAr, groupEn: d.groupEn, ar: d.ar, en: d.en, value: values[d.key] ?? null }));
  }

  // ------------------------------------------------------------------ the records
  private shown(r: Rec, en: boolean, values: Record<string, number | null>): string | null {
    const manual = s(r.x.value).trim();
    const metric = s(r.x.metric);
    const raw = manual || (metric && values[metric] !== null && values[metric] !== undefined ? Number(values[metric]).toLocaleString('en-US') : '');
    if (!raw) return null;
    const suffix = (en ? s(r.x.suffixEn) || s(r.x.suffixAr) : s(r.x.suffixAr) || s(r.x.suffixEn)).trim();
    return `${s(r.x.prefix)}${raw}${suffix ? ` ${suffix}` : ''}`;
  }

  private view(r: Rec, values: Record<string, number | null>) {
    const manual = s(r.x.value).trim();
    const metric = s(r.x.metric);
    return {
      id: r.id, titleAr: r.title, titleEn: s(r.x.titleEn), value: manual, metric, prefix: s(r.x.prefix), suffixAr: s(r.x.suffixAr), suffixEn: s(r.x.suffixEn),
      sortOrder: sortOf(r), isActive: isActive(r),
      /** where the shown number comes from */
      source: manual ? 'manual' : metric ? 'metric' : 'none',
      /** what the page shows now (Arabic) */
      shownValue: this.shown(r, false, values),
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }

  private async check(metric: string | null | undefined) {
    if (metric && !METRIC_KEYS.has(metric)) throw new BadRequestException('الرقم المختار غير معروف');
  }

  async list(q: StatisticsAdminQueryDto) {
    const recs = await this.store.list(CC.STATISTIC);
    const values = await this.metricValues(this.keysOf(recs));
    let rows = recs.map((r) => this.view(r, values));
    if (q.q) rows = rows.filter((x) => matches([x.titleAr, x.titleEn, x.value, x.metric], q.q!));
    rows = filterByCf(rows, q.cf, { titleAr: (x) => [x.titleAr], titleEn: (x) => [x.titleEn] });
    rows.sort(by((x) => x.sortOrder, (x) => x.id));
    return pageRows(rows, q, (x) => x);
  }

  async adminOne(id: number) {
    const r = await this.store.get(id, CC.STATISTIC);
    if (!r) throw new NotFoundException('الإحصائية غير موجودة');
    return this.view(r, await this.metricValues(this.keysOf([r])));
  }

  async create(dto: CreateStatisticDto, actor: AuthUser) {
    await this.check(dto.metric);
    const r = await this.store.create(CC.STATISTIC, {
      title: dto.titleAr.trim(),
      x: {
        titleEn: dto.titleEn?.trim() || null, value: dto.value?.trim() || null, metric: dto.metric || null, prefix: dto.prefix?.trim() || null,
        suffixAr: dto.suffixAr?.trim() || null, suffixEn: dto.suffixEn?.trim() || null, sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({ category: 'statistics', action: 'create', description: `إضافة إحصائية: ${r.title}`, actorId: actor.id, entityType: 'statistics', entityId: r.id });
    return this.view(r, await this.metricValues(this.keysOf([r])));
  }

  async update(id: number, dto: UpdateStatisticDto, actor: AuthUser) {
    const cur = await this.store.get(id, CC.STATISTIC);
    if (!cur) throw new NotFoundException('الإحصائية غير موجودة');
    await this.check(dto.metric);
    const clean = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
    const r = await this.store.update(id, {
      title: dto.titleAr?.trim(),
      x: {
        titleEn: clean(dto.titleEn), value: clean(dto.value), metric: dto.metric === undefined ? undefined : dto.metric || null, prefix: clean(dto.prefix),
        suffixAr: clean(dto.suffixAr), suffixEn: clean(dto.suffixEn), sortOrder: dto.sortOrder, isActive: dto.isActive,
      },
    });
    await this.audit.log({ category: 'statistics', action: 'update', description: `تعديل إحصائية: ${r!.title}`, actorId: actor.id, entityType: 'statistics', entityId: id });
    return this.view(r!, await this.metricValues(this.keysOf([r!])));
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
    const values = await this.metricValues(this.keysOf(rows));
    await this.audit.log({ category: 'statistics', action: 'delete', description: `حذف ${rows.length} إحصائية`, actorId: actor.id, entityType: 'statistics', details: { ids: unique }, changes: removedChanges('statistics', rows.map((r) => this.view(r, values))) });
    return { deleted: rows.length };
  }

  // ------------------------------------------------------------------ public
  /**
   * The figures of the home page (at most five, in their order): active statistics that have something to show.
   * `null` = none were defined here, so the home page keeps showing the older statistics news items.
   */
  async forHome(lang: Language | undefined) {
    const rows = (await this.store.list(CC.STATISTIC)).filter(isActive);
    if (!rows.length) return null;
    const en = lang === Language.EN;
    const values = await this.metricValues(this.keysOf(rows));
    return rows
      .sort(by((r) => sortOf(r), (r) => r.id))
      .map((r) => ({ id: r.id, title: (en && s(r.x.titleEn)) || r.title, excerpt: this.shown(r, en, values) }))
      .filter((x): x is { id: number; title: string; excerpt: string } => !!x.excerpt)
      .slice(0, MAX_ON_HOME);
  }

  async publicList(q: PublicStatisticsQueryDto) {
    return (await this.forHome(q.lang === 'en' ? Language.EN : Language.AR)) ?? [];
  }
}
