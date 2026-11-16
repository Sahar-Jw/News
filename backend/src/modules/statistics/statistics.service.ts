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
const MAX_ON_HOME = 5;

/**
 * The statistics band of the home page. Each statistic is a content record (main category STATISTIC): the Arabic and English titles,
 * a value typed by hand OR the key of a real number counted from the database, and an optional prefix / suffix ("+", "member"...).
 * A hand-typed value always wins; with none, the chosen real number is shown. Real numbers are cached for a minute.
 */
@Injectable()
export class StatisticsService {
  private cache: { at: number; values: Record<string, number | null> } | null = null;

  constructor(
    private readonly store: ContentStore,
    private readonly audit: AuditService,
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(News) private readonly news: Repository<News>,
  ) {}

  // ------------------------------------------------------------------ real numbers
  private ctx(): MetricCtx {
    return {
      store: this.store,
      sql: async (q) => Number(Object.values((await this.ds.query(q))[0] ?? {})[0] ?? 0),
      news: async (lang) => {
        const qb = this.news.createQueryBuilder('n');
        applyEligibility(qb, 'n', { lang: lang as Language | undefined, authenticated: false });
        onlyRegular(qb, 'n');
        return qb.getCount();
      },
    };
  }

  /** every real number now (a failing one is null, never an error for the page) */
  async metricValues(): Promise<Record<string, number | null>> {
    if (this.cache && Date.now() - this.cache.at < METRICS_TTL) return this.cache.values;
    const ctx = this.ctx();
    const entries = await Promise.all(METRICS.map(async (d) => [d.key, await d.value(ctx).then((n) => (Number.isFinite(n) ? n : null)).catch(() => null)] as const));
    const values = Object.fromEntries(entries);
    this.cache = { at: Date.now(), values };
    return values;
  }

  /** the catalog for the "choose a real number" list, with the current value of each */
  async catalog() {
    const values = await this.metricValues();
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
    const values = await this.metricValues();
    let rows = (await this.store.list(CC.STATISTIC)).map((r) => this.view(r, values));
    if (q.q) rows = rows.filter((x) => matches([x.titleAr, x.titleEn, x.value, x.metric], q.q!));
    rows = filterByCf(rows, q.cf, { titleAr: (x) => [x.titleAr], titleEn: (x) => [x.titleEn] });
    rows.sort(by((x) => x.sortOrder, (x) => x.id));
    return pageRows(rows, q, (x) => x);
  }

  async adminOne(id: number) {
    const r = await this.store.get(id, CC.STATISTIC);
    if (!r) throw new NotFoundException('الإحصائية غير موجودة');
    return this.view(r, await this.metricValues());
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
    return this.view(r, await this.metricValues());
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
    return this.view(r!, await this.metricValues());
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
    const values = await this.metricValues();
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
    const values = await this.metricValues();
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
