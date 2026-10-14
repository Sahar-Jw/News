import { Brackets, SelectQueryBuilder } from 'typeorm';
import { NewsStatus, SPECIAL_CATEGORY_CODES, Visibility } from '../../common/constants';
import { News } from '../../entities';

/**
 * A record is publicly "eligible" when (SRS 13.3):
 *   (status = published AND publish_at is null/<= now)  OR  (status = scheduled AND publish_at <= now)
 * AND language/visibility match the viewer. Evaluated at query time, so no background job is needed.
 */
export function applyEligibility(
  qb: SelectQueryBuilder<News>,
  alias: string,
  opts: { lang?: string; authenticated: boolean; now?: Date },
) {
  const now = opts.now ?? new Date();
  qb.andWhere(
    new Brackets((b) =>
      b
        .where(`(${alias}.status = :stPub AND (${alias}.publishAt IS NULL OR ${alias}.publishAt <= :now))`)
        .orWhere(`(${alias}.status = :stSch AND ${alias}.publishAt <= :now)`),
    ),
    { stPub: NewsStatus.PUBLISHED, stSch: NewsStatus.SCHEDULED, now },
  );
  if (!opts.authenticated) qb.andWhere(`${alias}.visibility = :visPub`, { visPub: Visibility.PUBLIC });
  if (opts.lang) qb.andWhere(`${alias}.language = :lang`, { lang: opts.lang });
  return qb;
}

/** Ordinary news only: excludes every reserved special-section code. */
export function onlyRegular(qb: SelectQueryBuilder<News>, alias: string) {
  return qb.andWhere(`${alias}.mainCategory NOT IN (:...specials)`, { specials: SPECIAL_CATEGORY_CODES });
}
