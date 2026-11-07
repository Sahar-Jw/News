import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CONTENT_CATEGORY_CODES } from '../../common/content-categories';
import { Language, NewsStatus, Visibility } from '../../common/constants';
import { News } from '../news/news.entity';

/**
 * One content record (FAQ, document, board member, course ...): a `news` row whose main category is the record's type.
 * `title`, `body`, `images` and `pdf` are the news columns; everything else (the English texts, fees, dates, order, visibility ...) is `x`,
 * the JSON column `news.extra`. The Arabic text is the news text itself, the English one sits in `x` (titleEn, bodyEn ...).
 */
export interface Rec {
  id: number;
  code: string;
  title: string;
  body: string | null;
  images: string[];
  pdf: string | null;
  x: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecInput {
  title: string;
  body?: string | null;
  images?: string[];
  pdf?: string | null;
  x?: Record<string, any>;
}

const TTL = Number(process.env.CONTENT_CACHE_TTL_MS ?? 5000);

/**
 * Reads and writes the content records. A type holds tens to a few thousand small rows, so the services filter / sort / page them in
 * memory; reads of a type are cached for a few seconds and the cache is dropped by every write made through this class.
 */
@Injectable()
export class ContentStore {
  private cache = new Map<string, { at: number; rows: Rec[] }>();

  constructor(@InjectRepository(News) private readonly repo: Repository<News>) {}

  private toRec(n: News): Rec {
    return {
      id: Number(n.id), code: n.mainCategory, title: n.title, body: n.body ?? null, images: n.images ?? [], pdf: n.pdf ?? null,
      x: (n.extra ?? {}) as Record<string, any>, createdAt: n.createdAt, updatedAt: n.updatedAt,
    };
  }

  invalidate() {
    this.cache.clear();
  }

  /** All records of one or several types, oldest first (ids ascend). */
  async list(codes: string | string[]): Promise<Rec[]> {
    const arr = Array.isArray(codes) ? codes : [codes];
    const key = [...arr].sort().join('|');
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return hit.rows;
    const rows = (await this.repo.find({ where: { mainCategory: In(arr) }, order: { id: 'ASC' } })).map((n) => this.toRec(n));
    this.cache.set(key, { at: Date.now(), rows });
    return rows;
  }

  /** One record straight from the database (never cached); optionally only if it is of one of `codes`. */
  async get(id: number, codes?: string | string[]): Promise<Rec | null> {
    const n = await this.repo.findOne({ where: { id } });
    if (!n || !CONTENT_CATEGORY_CODES.includes(n.mainCategory)) return null;
    if (codes && !(Array.isArray(codes) ? codes : [codes]).includes(n.mainCategory)) return null;
    return this.toRec(n);
  }

  async create(code: string, input: RecInput): Promise<Rec> {
    const saved = await this.repo.save(
      this.repo.create({
        title: input.title, mainCategory: code, subcategory: null, subject: null, body: input.body ?? null, images: input.images ?? [], pdf: input.pdf ?? null,
        extra: input.x ?? {}, language: Language.AR, status: NewsStatus.PUBLISHED, visibility: Visibility.PUBLIC, publishAt: new Date(), isFeatured: false,
      }),
    );
    this.invalidate();
    return this.toRec(saved);
  }

  /** `x` keys are merged into the stored ones (a key set to undefined is left alone, null clears it). */
  async update(id: number, patch: Partial<RecInput> & { code?: string }): Promise<Rec | null> {
    const n = await this.repo.findOne({ where: { id } });
    if (!n || !CONTENT_CATEGORY_CODES.includes(n.mainCategory)) return null;
    if (patch.code !== undefined && CONTENT_CATEGORY_CODES.includes(patch.code)) n.mainCategory = patch.code; // e.g. a document moved to another kind
    if (patch.title !== undefined) n.title = patch.title;
    if (patch.body !== undefined) n.body = patch.body;
    if (patch.images !== undefined) n.images = patch.images;
    if (patch.pdf !== undefined) n.pdf = patch.pdf;
    if (patch.x) {
      const next = { ...(n.extra ?? {}) } as Record<string, any>;
      for (const [k, v] of Object.entries(patch.x)) if (v !== undefined) next[k] = v;
      n.extra = next;
    }
    const saved = await this.repo.save(n);
    this.invalidate();
    return this.toRec(saved);
  }

  async remove(ids: number[]): Promise<number> {
    if (!ids.length) return 0;
    const res = await this.repo.delete({ id: In(ids), mainCategory: In(CONTENT_CATEGORY_CODES) });
    this.invalidate();
    return res.affected ?? 0;
  }
}

// ---- small readers shared by the services
export const isActive = (r: Rec) => r.x.isActive !== false;
export const sortOf = (r: Rec) => Number(r.x.sortOrder ?? 0);
/** `x.fooAr` / `x.fooEn`: the English text when asked for and present, otherwise the Arabic one. */
export const pick = (ar: unknown, en: unknown, isEn: boolean): string => String((isEn && en) || ar || '');
/** nullable text field of `x` as the string the old entities exposed ('' when empty) */
export const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
