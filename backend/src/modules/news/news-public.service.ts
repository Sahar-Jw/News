import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Language, SPECIAL_CATEGORY_CODES, SpecialCategory } from '../../common/constants';
import { adminPage, paged, publicPage } from '../../common/utils/pagination';
import { codeKey, escapeLike, excerpt, normalizeLabel, shuffle } from '../../common/utils/text';
import { News } from './news.entity';
import { FileStorageService } from '../files/file-storage.service';
import { SettingsService } from '../settings/settings.service';
import { PublicNewsQueryDto } from './news.dto';
import { applyEligibility, onlyRegular } from './news.eligibility';
import { ViewCounterService } from './view-counter.service';
import { ttlCache } from '../../common/utils/ttl-cache';

const CARD_COLUMNS = ['id', 'title', 'subject', 'mainCategory', 'subcategory', 'topics', 'excerpt', 'images', 'rating', 'isFeatured', 'publishAt', 'language', 'viewCount'];
const homeCache = ttlCache<{ settings: any; specials: News[]; featured: News[]; regular: News[] }>(Number(process.env.PUBLIC_CACHE_TTL_MS ?? 15_000));

export interface Viewer {
  authenticated: boolean;
}

@Injectable()
export class NewsPublicService {
  constructor(
    @InjectRepository(News) private readonly repo: Repository<News>,
    private readonly storage: FileStorageService,
    private readonly settings: SettingsService,
    private readonly views: ViewCounterService,
  ) {}

  /** Card = what lists/sections need. Never exposes created_by, status, or storage paths of other kinds. */
  card(n: News, withBody = false) {
    const images = n.images ?? [];
    return {
      id: n.id,
      title: n.title,
      subject: n.subject,
      mainCategory: n.mainCategory,
      subcategory: n.subcategory,
      topics: n.topics ?? [],
      excerpt: n.excerpt || excerpt(n.body) || n.subject || '',
      images: images.map((p) => this.storage.url(p)),
      rating: n.rating,
      isFeatured: n.isFeatured,
      publishAt: n.publishAt,
      language: n.language,
      viewCount: n.viewCount,
      ...(withBody && { body: n.body, pdf: n.pdf ? this.storage.url(n.pdf) : null }),
    };
  }

  private base(lang: Language | undefined, v: Viewer) {
    const qb = this.repo.createQueryBuilder('n');
    applyEligibility(qb, 'n', { lang, authenticated: v.authenticated });
    return qb;
  }

  /** Lists and sections only need the card fields: never load the rich-text body (can be tens of KB per row). */
  private slim(qb: ReturnType<NewsPublicService['base']>, extra: string[] = []) {
    return qb.select([...CARD_COLUMNS, ...extra].map((c) => `n.${c}`));
  }

  private order(qb: ReturnType<NewsPublicService['base']>) {
    return qb.orderBy('n.publishAt', 'DESC').addOrderBy('n.id', 'DESC');
  }

  async list(q: PublicNewsQueryDto, v: Viewer) {
    const p = publicPage(q);
    const qb = this.slim(onlyRegular(this.base(q.lang ?? Language.AR, v), 'n'));
    if (q.category) qb.andWhere('n.mainCategory = :cat', { cat: normalizeLabel(q.category) });
    if (q.subcategory) qb.andWhere('n.subcategory = :sub', { sub: normalizeLabel(q.subcategory) });
    if (q.topics) {
      const list = [...new Set(q.topics.split(',').map(normalizeLabel).filter(Boolean))].slice(0, 10);
      if (list.length) {
        const params: Record<string, string> = {};
        const conds = list.map((t, i) => {
          params[`tp${i}`] = `%${escapeLike(JSON.stringify(t))}%`;
          return `CAST(n.topics AS TEXT) ILIKE :tp${i}`;
        });
        qb.andWhere(`(${conds.join(' OR ')})`, params);
      }
    }
    if (q.q) this.applyTextSearch(qb, q.q);
    const [rows, total] = await this.order(qb).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.card(r)), total, p);
  }

  private applyTextSearch(qb: ReturnType<NewsPublicService['base']>, raw: string) {
    const like = `%${escapeLike(normalizeLabel(raw))}%`;
    // title + category + subcategory only – never the rich body (SRS FR-SEARCH-001/003)
    qb.andWhere('(n.title ILIKE :like OR n.mainCategory ILIKE :like OR n.subcategory ILIKE :like)', { like });
  }

  async search(q: PublicNewsQueryDto, v: Viewer) {
    const text = normalizeLabel(q.q ?? '');
    if (text.length < 2) throw new BadRequestException('اكتب حرفين على الأقل للبحث');
    return this.list({ ...q, q: text }, v);
  }

  async detail(id: number, v: Viewer, ip: string, ua: string) {
    // no language filter: a record stays reachable in its own language (SRS 26)
    const n = await this.base(undefined, v).andWhere('n.id = :id', { id }).getOne();
    if (!n) throw new NotFoundException('الصفحة غير موجودة');
    if (this.views.shouldCount(id, ip, ua)) {
      await this.repo.increment({ id }, 'viewCount', 1);
      n.viewCount += 1;
    }
    return { ...this.card(n, true), createdAt: n.createdAt, related: await this.related(n, v) };
  }

  /** Data for the link-preview page behind the share buttons. Anonymous viewer: members-only news only exposes a generic page. */
  async shareData(id: number, apiOrigin: string) {
    const n = await this.base(undefined, { authenticated: false }).andWhere('n.id = :id', { id }).getOne();
    const img = n?.images?.[0] ? this.storage.url(n.images[0]) : '';
    return {
      title: n?.title ?? 'News',
      description: n ? (excerpt(n.body) || n.subject || '').slice(0, 200) : '',
      image: img ? (/^https?:\/\//.test(img) ? img : `${apiOrigin}${img}`) : '',
      lang: n?.language ?? Language.AR,
    };
  }

  /** Same language + main category, ≥1 shared topic, ordered by shared count then newest, max 4 (SRS 13.5). */
  private async related(n: News, v: Viewer) {
    const mine = (n.topics ?? []).map((t) => t.toLowerCase());
    if (!mine.length) return [];
    const candidates = await this.order(this.slim(this.base(n.language, v)))
      .andWhere('n.mainCategory = :mc', { mc: n.mainCategory })
      .andWhere('n.id <> :id', { id: n.id })
      .take(200)
      .getMany();
    return candidates
      .map((c) => ({ c, shared: (c.topics ?? []).filter((t) => mine.includes(t.toLowerCase())).length }))
      .filter((x) => x.shared > 0)
      .sort((a, b) => b.shared - a.shared || (b.c.publishAt?.getTime() ?? 0) - (a.c.publishAt?.getTime() ?? 0))
      .slice(0, 4)
      .map((x) => this.card(x.c));
  }

  /**
   * Public menus, derived from published regular news only.
   * Main categories and subcategories are two independent lists (each has its own nav dropdown).
   */
  async categories(lang: Language | undefined, v: Viewer) {
    const L = lang ?? Language.AR;
    const [mainRows, subRows] = await Promise.all([
      onlyRegular(this.base(L, v), 'n').select('n.mainCategory', 'v').distinct(true).getRawMany(),
      this.base(L, v).andWhere('n.subcategory IS NOT NULL').andWhere('n.mainCategory NOT IN (:...sp)', { sp: SPECIAL_CATEGORY_CODES }).select('n.subcategory', 'v').distinct(true).getRawMany(),
    ]);
    const sort = (rows: { v: string }[]) => rows.map((r) => r.v).sort((a, b) => a.localeCompare(b));
    return { main: sort(mainRows), sub: sort(subRows) };
  }

  async section(code: string, lang: Language | undefined, v: Viewer) {
    const sec = codeKey(code);
    if (!SPECIAL_CATEGORY_CODES.includes(sec)) throw new NotFoundException('القسم غير موجود');
    const rows = await this.order(this.slim(this.base(lang ?? Language.AR, v), sec === SpecialCategory.COMPANY_OVERVIEW ? ['body', 'pdf'] : [])).andWhere('n.mainCategory = :sec', { sec }).take(100).getMany();
    return rows.map((r) => this.card(r, sec === SpecialCategory.COMPANY_OVERVIEW));
  }

  /** One round-trip set for the whole home page; section order/visibility come from `sections_home` settings. */
  async home(lang: Language | undefined, v: Viewer) {
    const L = lang ?? Language.AR;
    // the four queries are shared by every visitor for a few seconds; shuffling below still happens on every request
    const { settings, specials, featured, regular } = await homeCache(`${L}|${v.authenticated}`, async () => {
      const [settings, specials, featured, regular] = await Promise.all([
        this.settings.publicMap(),
        this.order(this.slim(this.base(L, v))).andWhere('n.mainCategory IN (:...sp)', { sp: SPECIAL_CATEGORY_CODES }).take(500).getMany(),
        this.order(this.slim(onlyRegular(this.base(L, v), 'n'))).andWhere('n.isFeatured = true').take(5).getMany(), // latest 5 featured news (flag is independent of status/visibility, but the record must still be eligible)
        this.order(this.slim(onlyRegular(this.base(L, v), 'n'))).take(4).getMany(),
      ]);
      return { settings, specials, featured, regular };
    });
    const by = (c: SpecialCategory) => specials.filter((s) => s.mainCategory === c);
    const card = (n: News) => this.card(n);

    return {
      lang: L,
      settings,
      breaking: by(SpecialCategory.BREAKING).slice(0, 10).map(card),
      featured: featured.map(card),
      news: regular.map(card),
      team: shuffle(by(SpecialCategory.TEAM)).slice(0, 6).map(card),
      services: by(SpecialCategory.SERVICES).slice(0, 3).map(card), // latest 3
      testimonials: shuffle(by(SpecialCategory.TESTIMONIALS)).slice(0, 4).map(card), // 4 random, new pick on every load
      partners: shuffle(by(SpecialCategory.PARTNERS).filter((p) => (p.images ?? []).length)).slice(0, 5).map((p) => ({ id: p.id, title: p.title, logo: this.storage.url(p.images[0]) })),
      experts: by(SpecialCategory.EXPERTS).slice(0, 4).map(card), // latest 4
      statistics: by(SpecialCategory.STATISTICS).slice(0, 5).map(card), // latest 5
      company: shuffle(by(SpecialCategory.COMPANY_OVERVIEW)).slice(0, 5).map(card), // 5 random, picture only
    };
  }
}
