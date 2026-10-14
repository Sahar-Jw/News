export const MAX_ALL_ROWS = 10000;

export interface PageParams {
  page: number;
  limit: number;
  skip: number;
  all: boolean;
}

/** Admin tables: limit is 10 | 20 | all (SRS FR-TBL-004). */
export function adminPage(q: { page?: number; limit?: string }): PageParams {
  const all = q.limit === 'all';
  const limit = all ? MAX_ALL_ROWS : Number(q.limit ?? 10) || 10;
  const page = all ? 1 : Math.max(1, Number(q.page ?? 1) || 1);
  return { page, limit, skip: (page - 1) * limit, all };
}

export function publicPage(q: { page?: number; limit?: number }, defLimit = 12, max = 50): PageParams {
  const limit = Math.min(max, Math.max(1, Number(q.limit ?? defLimit) || defLimit));
  const page = Math.max(1, Number(q.page ?? 1) || 1);
  return { page, limit, skip: (page - 1) * limit, all: false };
}

export function paged<T>(data: T[], total: number, p: PageParams) {
  return {
    data,
    meta: {
      page: p.page,
      limit: p.all ? total : p.limit,
      total,
      totalPages: p.all ? 1 : Math.max(1, Math.ceil(total / p.limit)),
      from: total === 0 ? 0 : p.skip + 1,
      to: Math.min(total, p.skip + data.length),
    },
  };
}
