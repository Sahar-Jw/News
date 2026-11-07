import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { CC, RESERVED_CATEGORY_CODES } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { escapeLike, sanitizeRichText } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { ContentLinksService } from '../content-links/content-links.service';
import { ContentStore, Rec, isActive, pick, s, sortOf } from '../content/content.store';
import { by, filterByCf, matches, pageRows } from '../content/mem';
import { FileStorageService } from '../files/file-storage.service';
import { Gallery } from '../gallery/gallery.entity';
import { News } from '../news/news.entity';
import { applyEligibility } from '../news/news.eligibility';
import { ActivityKind, CommitteeKind, MEMBER_ROLES, MemberRole } from './committee.entity';
import { CommitteeAdminQueryDto, CreateActivityDto, CreateCommitteeDto, CreateMemberDto, UpdateActivityDto, UpdateCommitteeDto, UpdateMemberDto } from './committees.dto';

const tags = (v: string | null) => (v ?? '').split(/[,،\n]/).map((x) => x.trim()).filter(Boolean);
const today = () => new Date().toISOString().slice(0, 10);

const COMMITTEE_CODES = [CC.COMMITTEE, CC.WOMEN_COMMITTEE] as string[];
const committeeCode = (kind: string) => (kind === 'women' ? CC.WOMEN_COMMITTEE : CC.COMMITTEE);
const kindOfCode = (code: string): CommitteeKind => (code === CC.WOMEN_COMMITTEE ? 'women' : 'sector');
const ACTIVITY_CODES = [CC.COMMITTEE_MEETING, CC.COMMITTEE_VISIT, CC.COMMITTEE_RECOMMENDATION, CC.COMMITTEE_INITIATIVE] as string[];
const activityCode = (kind: string) => `COMMITTEE_${kind.toUpperCase()}`;
const activityKind = (code: string) => code.replace(/^COMMITTEE_/, '').toLowerCase() as ActivityKind;

/** newest first, undated activities first (what ORDER BY event_date DESC does in PostgreSQL), then newest id first */
const newestFirst = (a: { eventDate: string | null; id: number }, b: { eventDate: string | null; id: number }) => {
  if (a.eventDate !== b.eventDate) {
    if (a.eventDate === null) return -1;
    if (b.eventDate === null) return 1;
    return a.eventDate < b.eventDate ? 1 : -1;
  }
  return b.id - a.id;
};

/**
 * Committees: every part is a news row. A committee is COMMITTEE (or WOMEN_COMMITTEE for the businesswomen one); its members are
 * COMMITTEE_MEMBER rows and its meetings / visits / recommendations / initiatives COMMITTEE_MEETING ... rows, each pointing to the
 * committee through `extra.parentId`. Linked news (content_links) and photo albums (galleries.committee_id) point to the committee's news id.
 */
@Injectable()
export class CommitteesService {
  constructor(
    private readonly store: ContentStore,
    @InjectRepository(News) private readonly news: Repository<News>,
    @InjectRepository(Gallery) private readonly galleries: Repository<Gallery>,
    private readonly links: ContentLinksService,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
  ) {}

  // ---------------------------------------------------------------- presenters
  private view(r: Rec) {
    return {
      id: r.id, kind: kindOfCode(r.code), nameAr: r.title, nameEn: s(r.x.nameEn), summaryAr: r.body ?? '', summaryEn: s(r.x.summaryEn),
      dutiesAr: s(r.x.dutiesAr), dutiesEn: s(r.x.dutiesEn), chairNameAr: s(r.x.chairNameAr), chairNameEn: s(r.x.chairNameEn),
      activityTagsAr: s(r.x.activityTagsAr), activityTagsEn: s(r.x.activityTagsEn), logo: r.images[0] ?? null, logoUrl: this.storage.url(r.images[0] ?? null),
      sortOrder: sortOf(r), isActive: isActive(r), createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }
  present(r: Rec) {
    const { logo, ...v } = this.view(r);
    void logo;
    return v;
  }
  private memberView(r: Rec) {
    return { id: r.id, committeeId: Number(r.x.parentId), role: (r.x.role ?? 'member') as MemberRole, nameAr: r.title, nameEn: s(r.x.nameEn), titleAr: s(r.x.titleAr), titleEn: s(r.x.titleEn), photoUrl: this.storage.url(r.images[0] ?? null), sortOrder: sortOf(r) };
  }
  private activityView(r: Rec) {
    return { id: r.id, committeeId: Number(r.x.parentId), kind: activityKind(r.code), titleAr: r.title, titleEn: s(r.x.titleEn), bodyAr: r.body ?? '', bodyEn: s(r.x.bodyEn), eventDate: (r.x.eventDate ?? null) as string | null };
  }

  private async mustFind(id: number) {
    const c = await this.store.get(id, COMMITTEE_CODES);
    if (!c) throw new NotFoundException('اللجنة غير موجودة');
    return c;
  }
  private async membersOf(id: number) {
    return (await this.store.list(CC.COMMITTEE_MEMBER)).filter((m) => Number(m.x.parentId) === id).sort(by((m) => sortOf(m), (m) => m.id));
  }
  private async activitiesOf(id: number) {
    return (await this.store.list(ACTIVITY_CODES)).filter((a) => Number(a.x.parentId) === id).map((a) => ({ r: a, v: this.activityView(a) })).sort((a, b) => newestFirst(a.v, b.v));
  }

  // ---------------------------------------------------------------- admin: committees
  async list(q: CommitteeAdminQueryDto) {
    let rows = (await this.store.list(q.kind ? committeeCode(q.kind) : COMMITTEE_CODES)).map((r) => this.view(r));
    if (q.q) rows = rows.filter((c) => matches([c.nameAr, c.nameEn, c.chairNameAr], q.q!));
    rows = filterByCf(rows, q.cf, { nameAr: (c) => [c.nameAr], nameEn: (c) => [c.nameEn], chairNameAr: (c) => [c.chairNameAr] });
    rows.sort(by((c) => c.sortOrder, (c) => c.id));
    return pageRows(rows, q, ({ logo, ...c }) => (void logo, c));
  }

  /** Everything the admin editor needs for one committee. */
  async full(id: number) {
    const c = await this.mustFind(id);
    const [members, activities, newsIds] = await Promise.all([this.membersOf(id), this.activitiesOf(id), this.links.newsIdsOf('committee', id)]);
    const linked = newsIds.length ? await this.news.find({ where: { id: In(newsIds) }, select: ['id', 'title', 'publishAt'], order: { publishAt: 'DESC' } }) : [];
    return { ...this.present(c), members: members.map((m) => this.memberView(m)), activities: activities.map((a) => a.v), news: linked.map((n) => ({ id: n.id, title: n.title, publishAt: n.publishAt })) };
  }

  async create(dto: CreateCommitteeDto, logo: Express.Multer.File | undefined, actor: AuthUser) {
    const path = logo ? await this.storage.saveImage(logo, 'committees', 800) : null;
    try {
      const r = await this.store.create(committeeCode(dto.kind), {
        title: dto.nameAr.trim(), body: dto.summaryAr?.trim() || null, images: path ? [path] : [],
        x: {
          nameEn: dto.nameEn?.trim() || null, summaryEn: dto.summaryEn?.trim() || null, dutiesAr: sanitizeRichText(dto.dutiesAr), dutiesEn: sanitizeRichText(dto.dutiesEn),
          chairNameAr: dto.chairNameAr?.trim() || null, chairNameEn: dto.chairNameEn?.trim() || null, activityTagsAr: dto.activityTagsAr?.trim() || null, activityTagsEn: dto.activityTagsEn?.trim() || null,
          sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true,
        },
      });
      await this.audit.log({ category: 'committees', action: 'create', description: `إضافة لجنة: ${r.title}`, actorId: actor.id, entityType: 'committees', entityId: r.id });
      return this.present(r);
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }

  async update(id: number, dto: UpdateCommitteeDto, logo: Express.Multer.File | undefined, actor: AuthUser) {
    const cur = await this.mustFind(id);
    const newPath = logo ? await this.storage.saveImage(logo, 'committees', 800) : null;
    const oldPath = cur.images[0] ?? null;
    try {
      const nz = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
      const rich = (v: string | null | undefined) => (v === undefined ? undefined : sanitizeRichText(v));
      const r = await this.store.update(id, {
        code: dto.kind !== undefined ? committeeCode(dto.kind) : undefined, title: dto.nameAr?.trim(), body: nz(dto.summaryAr),
        images: newPath ? [newPath] : dto.removeLogo ? [] : undefined,
        x: {
          nameEn: nz(dto.nameEn), summaryEn: nz(dto.summaryEn), dutiesAr: rich(dto.dutiesAr), dutiesEn: rich(dto.dutiesEn), chairNameAr: nz(dto.chairNameAr), chairNameEn: nz(dto.chairNameEn),
          activityTagsAr: nz(dto.activityTagsAr), activityTagsEn: nz(dto.activityTagsEn), sortOrder: dto.sortOrder, isActive: dto.isActive,
        },
      });
      await this.audit.log({ category: 'committees', action: 'update', description: `تعديل لجنة: ${r!.title}`, actorId: actor.id, entityType: 'committees', entityId: id });
      if (oldPath && oldPath !== (r!.images[0] ?? null)) await this.storage.remove(oldPath);
      return this.present(r!);
    } catch (e) {
      await this.storage.remove(newPath);
      throw e;
    }
  }

  async remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(COMMITTEE_CODES);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض اللجان غير موجودة'); // nothing is deleted
    const parts = (await this.store.list([CC.COMMITTEE_MEMBER, ...ACTIVITY_CODES])).filter((p) => unique.includes(Number(p.x.parentId)));
    await this.store.remove([...unique, ...parts.map((p) => p.id)]); // members and activities go with it
    await this.links.removeAllOf('committee', unique);
    await this.storage.removeMany([...rows.map((r) => r.images[0] ?? null), ...parts.map((p) => p.images[0] ?? null)]);
    await this.audit.log({ category: 'committees', action: 'delete', description: `حذف ${rows.length} من اللجان`, actorId: actor.id, entityType: 'committees', details: { ids: unique }, changes: removedChanges('committees', rows.map((r) => this.view(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- admin: members
  async addMember(committeeId: number, dto: CreateMemberDto, photo: Express.Multer.File | undefined, actor: AuthUser) {
    const c = await this.mustFind(committeeId);
    const path = photo ? await this.storage.saveImage(photo, 'committees', 600) : null;
    try {
      const r = await this.store.create(CC.COMMITTEE_MEMBER, {
        title: dto.nameAr.trim(), images: path ? [path] : [],
        x: { parentId: committeeId, role: dto.role, nameEn: dto.nameEn?.trim() || null, titleAr: dto.titleAr?.trim() || null, titleEn: dto.titleEn?.trim() || null, sortOrder: dto.sortOrder ?? 0 },
      });
      await this.audit.log({ category: 'committees', action: 'update', description: `إضافة عضو إلى لجنة ${c.title}: ${r.title}`, actorId: actor.id, entityType: 'committee_members', entityId: r.id });
      return this.memberView(r);
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }

  async updateMember(id: number, dto: UpdateMemberDto, photo: Express.Multer.File | undefined, actor: AuthUser) {
    const cur = await this.store.get(id, CC.COMMITTEE_MEMBER);
    if (!cur) throw new NotFoundException('العضو غير موجود');
    const newPath = photo ? await this.storage.saveImage(photo, 'committees', 600) : null;
    const oldPath = cur.images[0] ?? null;
    try {
      const nz = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
      const r = await this.store.update(id, {
        title: dto.nameAr?.trim(), images: newPath ? [newPath] : dto.removePhoto ? [] : undefined,
        x: { role: dto.role, nameEn: nz(dto.nameEn), titleAr: nz(dto.titleAr), titleEn: nz(dto.titleEn), sortOrder: dto.sortOrder },
      });
      await this.audit.log({ category: 'committees', action: 'update', description: `تعديل عضو لجنة: ${r!.title}`, actorId: actor.id, entityType: 'committee_members', entityId: id });
      if (oldPath && oldPath !== (r!.images[0] ?? null)) await this.storage.remove(oldPath);
      return this.memberView(r!);
    } catch (e) {
      await this.storage.remove(newPath);
      throw e;
    }
  }

  async removeMember(id: number, actor: AuthUser) {
    const m = await this.store.get(id, CC.COMMITTEE_MEMBER);
    if (!m) throw new NotFoundException('العضو غير موجود');
    await this.store.remove([id]);
    await this.storage.remove(m.images[0] ?? null);
    await this.audit.log({ category: 'committees', action: 'update', description: `حذف عضو لجنة: ${m.title}`, actorId: actor.id, entityType: 'committee_members', entityId: id });
    return { deleted: 1 };
  }

  // ---------------------------------------------------------------- admin: activities
  async addActivity(committeeId: number, dto: CreateActivityDto, actor: AuthUser) {
    const c = await this.mustFind(committeeId);
    const r = await this.store.create(activityCode(dto.kind), {
      title: dto.titleAr.trim(), body: sanitizeRichText(dto.bodyAr),
      x: { parentId: committeeId, titleEn: dto.titleEn?.trim() || null, bodyEn: sanitizeRichText(dto.bodyEn), eventDate: dto.eventDate ? dto.eventDate.slice(0, 10) : null },
    });
    await this.audit.log({ category: 'committees', action: 'update', description: `إضافة نشاط إلى لجنة ${c.title}: ${r.title}`, actorId: actor.id, entityType: 'committee_activities', entityId: r.id });
    return this.activityView(r);
  }

  async updateActivity(id: number, dto: UpdateActivityDto, actor: AuthUser) {
    const cur = await this.store.get(id, ACTIVITY_CODES);
    if (!cur) throw new NotFoundException('النشاط غير موجود');
    const r = await this.store.update(id, {
      code: dto.kind !== undefined ? activityCode(dto.kind) : undefined, title: dto.titleAr?.trim(), body: dto.bodyAr === undefined ? undefined : sanitizeRichText(dto.bodyAr),
      x: {
        titleEn: dto.titleEn === undefined ? undefined : dto.titleEn?.trim() || null, bodyEn: dto.bodyEn === undefined ? undefined : sanitizeRichText(dto.bodyEn),
        eventDate: dto.eventDate === undefined ? undefined : dto.eventDate ? dto.eventDate.slice(0, 10) : null,
      },
    });
    await this.audit.log({ category: 'committees', action: 'update', description: `تعديل نشاط لجنة: ${r!.title}`, actorId: actor.id, entityType: 'committee_activities', entityId: id });
    return this.activityView(r!);
  }

  async removeActivity(id: number, actor: AuthUser) {
    const a = await this.store.get(id, ACTIVITY_CODES);
    if (!a) throw new NotFoundException('النشاط غير موجود');
    await this.store.remove([id]);
    await this.audit.log({ category: 'committees', action: 'update', description: `حذف نشاط لجنة: ${a.title}`, actorId: actor.id, entityType: 'committee_activities', entityId: id });
    return { deleted: 1 };
  }

  // ---------------------------------------------------------------- admin: linked news
  /** Find news by title to attach (already linked ones are left out). */
  async searchNews(committeeId: number, q: string) {
    await this.mustFind(committeeId);
    const linked = await this.links.newsIdsOf('committee', committeeId);
    const qb = this.news.createQueryBuilder('n').select(['n.id', 'n.title', 'n.publishAt']).orderBy('n.publishAt', 'DESC', 'NULLS LAST').addOrderBy('n.id', 'DESC').take(10);
    qb.andWhere('n.mainCategory NOT IN (:...res)', { res: RESERVED_CATEGORY_CODES });
    if (q.trim()) qb.andWhere('n.title ILIKE :like', { like: `%${escapeLike(q.trim())}%` });
    if (linked.length) qb.andWhere('n.id NOT IN (:...linked)', { linked });
    return (await qb.getMany()).map((n) => ({ id: n.id, title: n.title, publishAt: n.publishAt }));
  }

  async linkNews(committeeId: number, newsIds: number[], actor: AuthUser) {
    const c = await this.mustFind(committeeId);
    const found = await this.news.find({ where: { id: In(newsIds), mainCategory: Not(In(RESERVED_CATEGORY_CODES)) }, select: ['id'] });
    await this.links.link('committee', committeeId, found.map((n) => Number(n.id)));
    await this.audit.log({ category: 'committees', action: 'update', description: `ربط أخبار باللجنة: ${c.title}`, actorId: actor.id, entityType: 'committees', entityId: committeeId, details: { newsIds } });
    return { linked: found.length };
  }

  async unlinkNews(committeeId: number, newsIds: number[], actor: AuthUser) {
    const c = await this.mustFind(committeeId);
    await this.links.unlink('committee', committeeId, newsIds);
    await this.audit.log({ category: 'committees', action: 'update', description: `فك ربط أخبار عن اللجنة: ${c.title}`, actorId: actor.id, entityType: 'committees', entityId: committeeId, details: { newsIds } });
    return { unlinked: newsIds.length };
  }

  // ---------------------------------------------------------------- public (active only)
  private card(r: Rec, en: boolean) {
    const c = this.view(r);
    return {
      id: c.id, kind: c.kind, name: pick(c.nameAr, c.nameEn, en), summary: pick(c.summaryAr, c.summaryEn, en), chairName: pick(c.chairNameAr, c.chairNameEn, en),
      tags: tags((en && c.activityTagsEn) || c.activityTagsAr || null), logoUrl: c.logoUrl,
    };
  }

  /** Sector committees with the "find my committee by business activity" search. Women kind has its own page. */
  async publicList(lang: string, q?: string) {
    let rows = (await this.store.list(CC.COMMITTEE)).filter(isActive).map((r) => ({ r, c: this.view(r) }));
    if (q?.trim()) rows = rows.filter(({ c }) => matches([c.nameAr, c.nameEn, c.activityTagsAr, c.activityTagsEn, c.summaryAr], q));
    rows.sort((a, b) => by((x: { c: { sortOrder: number; id: number } }) => x.c.sortOrder, (x) => x.c.id)(a, b));
    return rows.map(({ r }) => this.card(r, lang === 'en'));
  }

  /** The businesswomen committee page (first active committee of kind "women"). */
  async publicWomen(lang: string) {
    const c = (await this.store.list(CC.WOMEN_COMMITTEE)).filter(isActive).sort(by((r) => sortOf(r), (r) => r.id))[0];
    if (!c) throw new NotFoundException('اللجنة غير موجودة');
    return this.detail(c, lang);
  }

  async publicOne(id: number, lang: string) {
    const c = await this.store.get(id, COMMITTEE_CODES);
    if (!c || !isActive(c)) throw new NotFoundException('اللجنة غير موجودة');
    return this.detail(c, lang);
  }

  private async detail(c: Rec, lang: string) {
    const en = lang === 'en';
    const [members, acts, newsIds] = await Promise.all([this.membersOf(c.id), this.activitiesOf(c.id), this.links.newsIdsOf('committee', c.id)]);
    const rank = (r: unknown) => MEMBER_ROLES.indexOf(r as MemberRole);
    const t = today();
    const act = ({ r, v }: { r: Rec; v: ReturnType<CommitteesService['activityView']> }) => ({
      id: v.id, kind: v.kind, title: pick(v.titleAr, v.titleEn, en), body: pick(r.body, r.x.bodyEn, en), eventDate: v.eventDate, upcoming: !!v.eventDate && v.eventDate >= t,
    });
    let newsList: unknown[] = [];
    if (newsIds.length) {
      const qb = this.news.createQueryBuilder('n').select(['n.id', 'n.title', 'n.excerpt', 'n.images', 'n.publishAt']).where('n.id IN (:...newsIds)', { newsIds });
      applyEligibility(qb, 'n', { lang: en ? 'en' : 'ar', authenticated: false });
      qb.orderBy('n.publishAt', 'DESC').addOrderBy('n.id', 'DESC').take(30);
      newsList = (await qb.getMany()).map((n) => ({ id: n.id, title: n.title, excerpt: n.excerpt ?? '', image: this.storage.url((n.images ?? [])[0] ?? null), publishAt: n.publishAt }));
    }
    const albums = await this.galleries.find({ where: { committeeId: c.id }, order: { id: 'DESC' }, take: 24 });
    const gallery = albums.map((g) => ({ id: g.id, title: (en && g.titleEn) || g.titleAr, cover: this.storage.url((g.images ?? [])[0] ?? null), count: (g.images ?? []).length }));
    const byKind = (k: ActivityKind) => acts.filter((a) => a.v.kind === k).map(act);
    return {
      ...this.card(c, en), duties: pick(c.x.dutiesAr, c.x.dutiesEn, en),
      members: [...members].sort((a, b) => rank(a.x.role) - rank(b.x.role)).map((m) => ({ id: m.id, role: m.x.role, name: pick(m.title, m.x.nameEn, en), title: pick(m.x.titleAr, m.x.titleEn, en), photoUrl: this.storage.url(m.images[0] ?? null) })),
      meetings: [...byKind('meeting'), ...byKind('visit')].sort((a, b) => (b.eventDate ?? '').localeCompare(a.eventDate ?? '')),
      recommendations: byKind('recommendation'),
      initiatives: byKind('initiative'),
      news: newsList,
      gallery,
    };
  }
}
