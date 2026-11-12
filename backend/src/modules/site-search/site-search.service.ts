import { Injectable } from '@nestjs/common';
import { CC, DOC_CODES } from '../../common/content-categories';
import { paged, publicPage } from '../../common/utils/pagination';
import { stripHtml } from '../../common/utils/text';
import { ContentStore, Rec, isActive, pick, s } from '../content/content.store';
import { matches } from '../content/mem';
import { SEARCH_GROUPS, SiteSearchQueryDto } from './site-search.dto';

type Group = (typeof SEARCH_GROUPS)[number];
interface Source { group: Group; codes: string[]; url: (r: Rec) => string }

/** Where every kind of content lives on the public site (the page that shows it). */
const SOURCES: Source[] = [
  { group: 'events', codes: [CC.OCCASION], url: (r) => `/occasions/view?id=${r.id}` },
  { group: 'documents', codes: DOC_CODES, url: (r) => `/documents/view?id=${r.id}` },
  { group: 'committees', codes: [CC.COMMITTEE], url: (r) => `/committees/view?id=${r.id}` },
  { group: 'committees', codes: [CC.WOMEN_COMMITTEE], url: () => '/committees/women' },
  { group: 'services', codes: [CC.SERVICE], url: (r) => `/services/view?id=${r.id}` },
  { group: 'training', codes: [CC.COURSE], url: (r) => `/training/view?id=${r.id}` },
  { group: 'incubator', codes: [CC.INCUBATOR_PROJECT], url: () => '/incubator#projects' },
  { group: 'get2trade', codes: [CC.G2T_PACKAGE], url: () => '/get2trade/packages' },
  { group: 'get2trade', codes: [CC.G2T_SPACE], url: () => '/get2trade/spaces' },
  { group: 'expo', codes: [CC.EXPO_EXHIBITOR], url: () => '/expo/exhibitors' },
  { group: 'expo', codes: [CC.EXPO_SPONSOR], url: () => '/expo/sponsors' },
  { group: 'expo', codes: [CC.EXPO_SESSION], url: () => '/expo/programme' },
  { group: 'board', codes: [CC.BOARD_MEMBER], url: (r) => `/board/view?id=${r.id}` },
  { group: 'faq', codes: [CC.FAQ], url: () => '/faq' },
  { group: 'pages', codes: [CC.PAGE], url: (r) => `/pages/view?slug=${encodeURIComponent(s(r.x.slug))}` },
];

/** every text value of a record's extra data (English texts, sector, organizer, place, tags ...) so the search sees all of it */
const texts = (x: Record<string, any>): string[] => Object.entries(x)
  .filter(([k, v]) => (typeof v === 'string' || typeof v === 'number') && !/(^|[a-z])(Url|Path|Id)$|^(isActive|sortOrder|parentId|slug)$/.test(k))
  .map(([, v]) => stripHtml(String(v)));

/**
 * One search over everything on the site that is not ordinary news: events, documents, committees, services, courses, incubator projects,
 * Get2Trade, the expo, the board, FAQs and static pages. The records are read through the content store (cached for a few seconds), so a
 * search is a filter in memory, like every other list of the site. Only active records are searched.
 */
@Injectable()
export class SiteSearchService {
  constructor(private readonly store: ContentStore) {}

  async search(q: SiteSearchQueryDto) {
    const en = q.lang === 'en';
    const sources = SOURCES.filter((x) => !q.group || x.group === q.group);
    const hits: { group: Group; id: number; title: string; excerpt: string; url: string; image: string | null; date: string | null; at: number }[] = [];
    const counts: Record<string, number> = {};
    for (const src of sources) {
      for (const r of await this.store.list(src.codes)) {
        if (!isActive(r)) continue;
        if (!matches([r.title, stripHtml(r.body), ...texts(r.x)], q.q)) continue;
        const title = pick(r.title, r.x.titleEn ?? r.x.nameEn ?? r.x.questionEn, en);
        const body = stripHtml(pick(r.body, r.x.bodyEn ?? r.x.summaryEn ?? r.x.descriptionEn, en));
        hits.push({
          group: src.group, id: r.id, title, excerpt: body.slice(0, 180), url: src.url(r), image: null,
          date: s(r.x.eventDate ?? r.x.docDate ?? r.finishAt) || null, at: r.updatedAt?.getTime?.() ?? 0,
        });
        counts[src.group] = (counts[src.group] ?? 0) + 1;
      }
    }
    // a title match comes first, then the most recently changed
    const needle = q.q.trim().toLowerCase();
    hits.sort((a, b) => Number(b.title.toLowerCase().includes(needle)) - Number(a.title.toLowerCase().includes(needle)) || b.at - a.at);
    const p = publicPage(q, 12);
    const data = hits.slice(p.skip, p.skip + p.limit).map(({ at: _at, ...x }) => x);
    return { ...paged(data, hits.length, p), counts };
  }
}
