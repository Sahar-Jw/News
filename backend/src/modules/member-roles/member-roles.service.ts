import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CC } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { ContentStore } from '../content/content.store';
import { SiteSetting } from '../settings/site-setting.entity';

/**
 * The lists of positions a person can hold, one list per page: the board of directors, the committees (Committees & sectors) and the
 * Women Business Committee. Each list is edited in the settings of its own page (add, rename, reorder, delete) and is stored as one JSON
 * setting: category `member_roles`, key = the page. The ORDER of the list is the hierarchy of the public page (first = top).
 * A position is saved on a person as its `key` (never its label), so renaming a position renames it for everybody who holds it.
 */
export type RoleScope = 'board' | 'committee' | 'women';
export const ROLE_SCOPES: RoleScope[] = ['board', 'committee', 'women'];
export interface RoleOption { key: string; ar: string; en: string }

export const MEMBER_ROLES_CATEGORY = 'member_roles';
/** The plain member: the fallback of every person without a position, so it can be renamed but never deleted. */
export const BASE_ROLE_KEY = 'member';

/** What a page shows until somebody edits its list (the same positions the site always had). */
export const DEFAULT_ROLES: Record<RoleScope, RoleOption[]> = {
  board: [
    { key: 'president', ar: 'الرئيس', en: 'President' },
    { key: 'vice_president', ar: 'نائب الرئيس', en: 'Vice president' },
    { key: 'secretary', ar: 'أمين السر', en: 'Secretary' },
    { key: 'treasurer', ar: 'أمين الصندوق', en: 'Treasurer' },
    { key: 'member', ar: 'عضو', en: 'Member' },
  ],
  committee: [
    { key: 'chair', ar: 'الرئيس', en: 'Chair' },
    { key: 'secretary', ar: 'أمين السر', en: 'Secretary' },
    { key: 'vice', ar: 'نائب الرئيس', en: 'Vice chair' },
    { key: 'member', ar: 'عضو', en: 'Member' },
  ],
  women: [
    { key: 'chair', ar: 'رئيسة اللجنة', en: 'Chair' },
    { key: 'vice', ar: 'نائبة الرئيسة', en: 'Vice chair' },
    { key: 'secretary', ar: 'أمينة السر', en: 'Secretary' },
    { key: 'member', ar: 'عضوة', en: 'Member' },
  ],
};

const MAX_OPTIONS = 20;
const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
const CACHE_MS = 5000;

@Injectable()
export class MemberRolesService {
  private cache?: { at: number; data: Record<RoleScope, RoleOption[]> };

  constructor(
    @InjectRepository(SiteSetting) private readonly repo: Repository<SiteSetting>,
    private readonly store: ContentStore,
    private readonly audit: AuditService,
  ) {}

  /** a stored value that is not a valid list falls back to the defaults, so a damaged setting never breaks a page */
  private parse(raw: string | null, scope: RoleScope): RoleOption[] {
    try {
      const v = JSON.parse(raw ?? '');
      if (!Array.isArray(v)) throw new Error();
      const out: RoleOption[] = [];
      for (const o of v) {
        if (!o || typeof o.key !== 'string' || !KEY_RE.test(o.key) || typeof o.ar !== 'string' || !o.ar.trim()) throw new Error();
        out.push({ key: o.key, ar: o.ar.trim(), en: typeof o.en === 'string' ? o.en.trim() : '' });
      }
      if (!out.length || !out.some((o) => o.key === BASE_ROLE_KEY)) throw new Error();
      return out;
    } catch {
      return DEFAULT_ROLES[scope].map((o) => ({ ...o }));
    }
  }

  async all(): Promise<Record<RoleScope, RoleOption[]>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.data;
    const rows = await this.repo.find({ where: { category: MEMBER_ROLES_CATEGORY } });
    const data = Object.fromEntries(ROLE_SCOPES.map((sc) => [sc, this.parse(rows.find((r) => r.key === sc)?.value ?? null, sc)])) as Record<RoleScope, RoleOption[]>;
    this.cache = { at: Date.now(), data };
    return data;
  }

  async list(scope: RoleScope): Promise<RoleOption[]> {
    return (await this.all())[scope];
  }

  /** throws unless `key` is one of the page's positions (used before a person is saved) */
  async assertKey(scope: RoleScope, key: string | undefined | null) {
    if (key === undefined || key === null) return;
    if (!(await this.list(scope)).some((o) => o.key === key)) throw new BadRequestException('الصفة غير موجودة في قائمة الصفات. أضفها أولاً من إعدادات الصفحة');
  }

  /** the position's place in the hierarchy (0 = top); an unknown key goes last */
  async ranker(scope: RoleScope): Promise<(key: unknown) => number> {
    const keys = (await this.list(scope)).map((o) => o.key);
    return (key) => {
      const i = keys.indexOf(String(key ?? BASE_ROLE_KEY));
      return i < 0 ? keys.length : i;
    };
  }

  /** how many people hold each position of the page */
  async usage(scope: RoleScope): Promise<Record<string, number>> {
    const n: Record<string, number> = {};
    const bump = (k: unknown) => { const key = String(k ?? BASE_ROLE_KEY); n[key] = (n[key] ?? 0) + 1; };
    if (scope === 'board') {
      for (const r of await this.store.list(CC.BOARD_MEMBER)) bump(r.x.position);
    } else {
      const parents = new Set((await this.store.list(scope === 'women' ? CC.WOMEN_COMMITTEE : CC.COMMITTEE)).map((c) => c.id));
      for (const m of await this.store.list(CC.COMMITTEE_MEMBER)) if (parents.has(Number(m.x.parentId))) bump(m.x.role);
    }
    return n;
  }

  async get(scope: RoleScope) {
    return { scope, options: await this.list(scope), usage: await this.usage(scope) };
  }

  /** Replaces the list of a page. Existing positions keep their key (so people keep them); new ones (no key) get one. */
  async save(scope: RoleScope, items: Array<Partial<RoleOption>>, actor: AuthUser) {
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('يجب أن تحتوي القائمة على صفة واحدة على الأقل');
    if (items.length > MAX_OPTIONS) throw new BadRequestException(`الحد الأقصى ${MAX_OPTIONS} صفة`);
    const current = await this.list(scope);
    const known = new Set(current.map((o) => o.key));
    const used = new Set<string>();
    const out: RoleOption[] = [];
    const seenAr = new Set<string>();
    items.forEach((it, i) => {
      const ar = typeof it.ar === 'string' ? it.ar.trim() : '';
      const en = typeof it.en === 'string' ? it.en.trim() : '';
      if (!ar) throw new BadRequestException('اسم الصفة بالعربية مطلوب');
      if (ar.length > 60 || en.length > 60) throw new BadRequestException('اسم الصفة طويل (الحد 60 حرفاً)');
      if (seenAr.has(ar)) throw new BadRequestException(`الصفة «${ar}» مكررة`);
      seenAr.add(ar);
      let key = typeof it.key === 'string' ? it.key.trim() : '';
      if (key) {
        if (!KEY_RE.test(key) || !known.has(key)) throw new BadRequestException('صفة غير معروفة');
      } else {
        do key = `r${Date.now().toString(36)}${i.toString(36)}${Math.random().toString(36).slice(2, 5)}`; while (known.has(key) || used.has(key));
      }
      if (used.has(key)) throw new BadRequestException('صفة مكررة');
      used.add(key);
      out.push({ key, ar, en });
    });
    if (!used.has(BASE_ROLE_KEY)) throw new BadRequestException('لا يمكن حذف صفة «العضو» الأساسية، يمكنك تغيير اسمها فقط');

    // a position somebody still holds cannot be deleted: move those people to another position first
    const removed = current.filter((o) => !used.has(o.key));
    if (removed.length) {
      const use = await this.usage(scope);
      const busy = removed.filter((o) => (use[o.key] ?? 0) > 0);
      if (busy.length) throw new ConflictException(`لا يمكن حذف: ${busy.map((o) => `«${o.ar}» (${use[o.key]})`).join('، ')}. غيّر صفة هؤلاء الأعضاء أولاً.`);
    }

    const value = JSON.stringify(out);
    let row = await this.repo.findOne({ where: { category: MEMBER_ROLES_CATEGORY, key: scope } });
    if (row) row.value = value;
    else row = this.repo.create({ category: MEMBER_ROLES_CATEGORY, key: scope, value, valueType: 'json' });
    await this.repo.save(row);
    this.cache = undefined;
    const title = scope === 'board' ? 'مجلس الإدارة' : scope === 'women' ? 'لجنة سيدات الأعمال' : 'اللجان والقطاعات';
    await this.audit.log({
      category: 'settings', action: 'update', description: `تعديل قائمة الصفات في ${title}`, actorId: actor.id, entityType: 'site_settings',
      details: { scope, positions: out.map((o) => o.ar), removed: removed.map((o) => o.ar) },
    });
    return this.get(scope);
  }
}
