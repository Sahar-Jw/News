import { Repository } from 'typeorm';
import { Matcher, candidateRegex, htmlToPlain, sqlNormalized, textMatches } from '../../common/utils/name-match';
import { applyEligibility, onlyRegular } from './news.eligibility';
import { News } from './news.entity';

/**
 * The published news that mention a person or a committee, newest first (see common/utils/name-match.ts for what "mention" means:
 * a name does not have to be written exactly as saved). The database narrows the news down with a cheap filter, then each candidate
 * is checked word by word. Only ordinary public news count.
 */
export async function mentionedNews(
  repo: Repository<News>,
  matchers: Matcher[],
  opts: { lang: 'ar' | 'en'; limit?: number; candidates?: number },
): Promise<News[]> {
  const re = candidateRegex(matchers);
  if (!re) return [];
  const qb = repo.createQueryBuilder('n').select(['n.id', 'n.title', 'n.subject', 'n.excerpt', 'n.body', 'n.images', 'n.publishAt']);
  qb.where(`${sqlNormalized(`coalesce(n.title, '') || ' ' || coalesce(n.subject, '') || ' ' || coalesce(n.excerpt, '') || ' ' || coalesce(n.body, '')`)} ~ :re`, { re });
  onlyRegular(qb, 'n');
  applyEligibility(qb, 'n', { lang: opts.lang, authenticated: false });
  qb.orderBy('n.publishAt', 'DESC', 'NULLS LAST').addOrderBy('n.id', 'DESC').take(opts.candidates ?? 300);
  const rows = await qb.getMany();
  const hits = rows.filter((r) => textMatches(matchers, `${r.title ?? ''} ${r.subject ?? ''} ${r.excerpt ?? ''} ${htmlToPlain(r.body)}`));
  return hits.slice(0, opts.limit ?? 30);
}

/** two lists of news merged without repeats, newest first */
export function mergeNews(a: News[], b: News[], limit = 30): News[] {
  const byId = new Map<number, News>();
  for (const n of [...a, ...b]) if (!byId.has(Number(n.id))) byId.set(Number(n.id), n);
  const t = (n: News) => (n.publishAt ? new Date(n.publishAt).getTime() : 0);
  return [...byId.values()].sort((x, y) => t(y) - t(x) || Number(y.id) - Number(x.id)).slice(0, limit);
}
