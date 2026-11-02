import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike, sanitizeRichText } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { ContentLinksService } from '../content-links/content-links.service';
import { FileStorageService } from '../files/file-storage.service';
import { News } from '../news/news.entity';
import { applyEligibility } from '../news/news.eligibility';
import { ActivityKind, Committee, CommitteeActivity, CommitteeKind, CommitteeMember, MEMBER_ROLES, MemberRole } from './committee.entity';
import { CommitteeAdminQueryDto, CreateActivityDto, CreateCommitteeDto, CreateMemberDto, UpdateActivityDto, UpdateCommitteeDto, UpdateMemberDto } from './committees.dto';

const tags = (v: string | null) => (v ?? '').split(/[,،\n]/).map((x) => x.trim()).filter(Boolean);
const today = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class CommitteesService {
  constructor(
    @InjectRepository(Committee) private readonly repo: Repository<Committee>,
    @InjectRepository(CommitteeMember) private readonly members: Repository<CommitteeMember>,
    @InjectRepository(CommitteeActivity) private readonly activities: Repository<CommitteeActivity>,
    @InjectRepository(News) private readonly news: Repository<News>,
    private readonly links: ContentLinksService,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
  ) {}

  // ---------------------------------------------------------------- presenters
  present(c: Committee) {
    return {
      id: c.id, kind: c.kind, nameAr: c.nameAr, nameEn: c.nameEn ?? '', summaryAr: c.summaryAr ?? '', summaryEn: c.summaryEn ?? '',
      dutiesAr: c.dutiesAr ?? '', dutiesEn: c.dutiesEn ?? '', chairNameAr: c.chairNameAr ?? '', chairNameEn: c.chairNameEn ?? '',
      activityTagsAr: c.activityTagsAr ?? '', activityTagsEn: c.activityTagsEn ?? '', logoUrl: this.storage.url(c.logo),
      sortOrder: c.sortOrder, isActive: c.isActive, createdAt: c.createdAt, updatedAt: c.updatedAt,
    };
  }
  presentMember(m: CommitteeMember) {
    return { id: m.id, committeeId: m.committeeId, role: m.role, nameAr: m.nameAr, nameEn: m.nameEn ?? '', titleAr: m.titleAr ?? '', titleEn: m.titleEn ?? '', photoUrl: this.storage.url(m.photo), sortOrder: m.sortOrder };
  }
  presentActivity(a: CommitteeActivity) {
    return { id: a.id, committeeId: a.committeeId, kind: a.kind, titleAr: a.titleAr, titleEn: a.titleEn ?? '', bodyAr: a.bodyAr ?? '', bodyEn: a.bodyEn ?? '', eventDate: a.eventDate };
  }

  private async mustFind(id: number) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('اللجنة غير موجودة');
    return c;
  }

  // ---------------------------------------------------------------- admin: committees
  async list(q: CommitteeAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('c');
    if (q.kind) qb.andWhere('c.kind = :kind', { kind: q.kind });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('c.nameAr ILIKE :like', { like }).orWhere('c.nameEn ILIKE :like', { like }).orWhere('c.chairNameAr ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { nameAr: 'c.nameAr', nameEn: 'c.nameEn', chairNameAr: 'c.chairNameAr' });
    qb.orderBy('c.sortOrder', 'ASC').addOrderBy('c.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  /** Everything the admin editor needs for one committee. */
  async full(id: number) {
    const c = await this.mustFind(id);
    const [members, activities, newsIds] = await Promise.all([
      this.members.find({ where: { committeeId: id }, order: { sortOrder: 'ASC', id: 'ASC' } }),
      this.activities.find({ where: { committeeId: id }, order: { eventDate: 'DESC', id: 'DESC' } }),
      this.links.newsIdsOf('committee', id),
    ]);
    const linked = newsIds.length ? await this.news.find({ where: { id: In(newsIds) }, select: ['id', 'title', 'publishAt'], order: { publishAt: 'DESC' } }) : [];
    return { ...this.present(c), members: members.map((m) => this.presentMember(m)), activities: activities.map((a) => this.presentActivity(a)), news: linked.map((n) => ({ id: n.id, title: n.title, publishAt: n.publishAt })) };
  }

  async create(dto: CreateCommitteeDto, logo: Express.Multer.File | undefined, actor: AuthUser) {
    const path = logo ? await this.storage.saveImage(logo, 'committees', 800) : null;
    try {
      const saved = await this.repo.save(
        this.repo.create({
          kind: dto.kind as CommitteeKind, nameAr: dto.nameAr.trim(), nameEn: dto.nameEn?.trim() || null, summaryAr: dto.summaryAr?.trim() || null, summaryEn: dto.summaryEn?.trim() || null,
          dutiesAr: sanitizeRichText(dto.dutiesAr), dutiesEn: sanitizeRichText(dto.dutiesEn), chairNameAr: dto.chairNameAr?.trim() || null, chairNameEn: dto.chairNameEn?.trim() || null,
          activityTagsAr: dto.activityTagsAr?.trim() || null, activityTagsEn: dto.activityTagsEn?.trim() || null, logo: path, sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true,
        }),
      );
      await this.audit.log({ category: 'committees', action: 'create', description: `إضافة لجنة: ${saved.nameAr}`, actorId: actor.id, entityType: 'committees', entityId: saved.id });
      return this.present(saved);
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }

  async update(id: number, dto: UpdateCommitteeDto, logo: Express.Multer.File | undefined, actor: AuthUser) {
    const c = await this.mustFind(id);
    const newPath = logo ? await this.storage.saveImage(logo, 'committees', 800) : null;
    const oldPath = c.logo;
    try {
      if (dto.kind !== undefined) c.kind = dto.kind as CommitteeKind;
      if (dto.nameAr !== undefined) c.nameAr = dto.nameAr.trim();
      if (dto.nameEn !== undefined) c.nameEn = dto.nameEn?.trim() || null;
      if (dto.summaryAr !== undefined) c.summaryAr = dto.summaryAr?.trim() || null;
      if (dto.summaryEn !== undefined) c.summaryEn = dto.summaryEn?.trim() || null;
      if (dto.dutiesAr !== undefined) c.dutiesAr = sanitizeRichText(dto.dutiesAr);
      if (dto.dutiesEn !== undefined) c.dutiesEn = sanitizeRichText(dto.dutiesEn);
      if (dto.chairNameAr !== undefined) c.chairNameAr = dto.chairNameAr?.trim() || null;
      if (dto.chairNameEn !== undefined) c.chairNameEn = dto.chairNameEn?.trim() || null;
      if (dto.activityTagsAr !== undefined) c.activityTagsAr = dto.activityTagsAr?.trim() || null;
      if (dto.activityTagsEn !== undefined) c.activityTagsEn = dto.activityTagsEn?.trim() || null;
      if (dto.sortOrder !== undefined) c.sortOrder = dto.sortOrder;
      if (dto.isActive !== undefined) c.isActive = dto.isActive;
      if (newPath) c.logo = newPath;
      else if (dto.removeLogo) c.logo = null;
      const saved = await this.repo.save(c);
      await this.audit.log({ category: 'committees', action: 'update', description: `تعديل لجنة: ${saved.nameAr}`, actorId: actor.id, entityType: 'committees', entityId: id });
      if (oldPath && oldPath !== saved.logo) await this.storage.remove(oldPath);
      return this.present(saved);
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
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض اللجان غير موجودة'); // nothing is deleted
    const memberRows = await this.members.find({ where: { committeeId: In(unique) } });
    await this.repo.delete({ id: In(unique) }); // members and activities go with it (ON DELETE CASCADE)
    await this.links.removeAllOf('committee', unique);
    await this.storage.removeMany([...rows.map((r) => r.logo), ...memberRows.map((m) => m.photo)]);
    await this.audit.log({ category: 'committees', action: 'delete', description: `حذف ${rows.length} من اللجان`, actorId: actor.id, entityType: 'committees', details: { ids: unique }, changes: removedChanges('committees', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- admin: members
  async addMember(committeeId: number, dto: CreateMemberDto, photo: Express.Multer.File | undefined, actor: AuthUser) {
    const c = await this.mustFind(committeeId);
    const path = photo ? await this.storage.saveImage(photo, 'committees', 600) : null;
    try {
      const saved = await this.members.save(
        this.members.create({ committeeId, role: dto.role as MemberRole, nameAr: dto.nameAr.trim(), nameEn: dto.nameEn?.trim() || null, titleAr: dto.titleAr?.trim() || null, titleEn: dto.titleEn?.trim() || null, photo: path, sortOrder: dto.sortOrder ?? 0 }),
      );
      await this.audit.log({ category: 'committees', action: 'update', description: `إضافة عضو إلى لجنة ${c.nameAr}: ${saved.nameAr}`, actorId: actor.id, entityType: 'committee_members', entityId: saved.id });
      return this.presentMember(saved);
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }

  async updateMember(id: number, dto: UpdateMemberDto, photo: Express.Multer.File | undefined, actor: AuthUser) {
    const m = await this.members.findOne({ where: { id } });
    if (!m) throw new NotFoundException('العضو غير موجود');
    const newPath = photo ? await this.storage.saveImage(photo, 'committees', 600) : null;
    const oldPath = m.photo;
    try {
      if (dto.role !== undefined) m.role = dto.role as MemberRole;
      if (dto.nameAr !== undefined) m.nameAr = dto.nameAr.trim();
      if (dto.nameEn !== undefined) m.nameEn = dto.nameEn?.trim() || null;
      if (dto.titleAr !== undefined) m.titleAr = dto.titleAr?.trim() || null;
      if (dto.titleEn !== undefined) m.titleEn = dto.titleEn?.trim() || null;
      if (dto.sortOrder !== undefined) m.sortOrder = dto.sortOrder;
      if (newPath) m.photo = newPath;
      else if (dto.removePhoto) m.photo = null;
      const saved = await this.members.save(m);
      await this.audit.log({ category: 'committees', action: 'update', description: `تعديل عضو لجنة: ${saved.nameAr}`, actorId: actor.id, entityType: 'committee_members', entityId: id });
      if (oldPath && oldPath !== saved.photo) await this.storage.remove(oldPath);
      return this.presentMember(saved);
    } catch (e) {
      await this.storage.remove(newPath);
      throw e;
    }
  }

  async removeMember(id: number, actor: AuthUser) {
    const m = await this.members.findOne({ where: { id } });
    if (!m) throw new NotFoundException('العضو غير موجود');
    await this.members.delete({ id });
    await this.storage.remove(m.photo);
    await this.audit.log({ category: 'committees', action: 'update', description: `حذف عضو لجنة: ${m.nameAr}`, actorId: actor.id, entityType: 'committee_members', entityId: id });
    return { deleted: 1 };
  }

  // ---------------------------------------------------------------- admin: activities
  async addActivity(committeeId: number, dto: CreateActivityDto, actor: AuthUser) {
    const c = await this.mustFind(committeeId);
    const saved = await this.activities.save(
      this.activities.create({ committeeId, kind: dto.kind as ActivityKind, titleAr: dto.titleAr.trim(), titleEn: dto.titleEn?.trim() || null, bodyAr: sanitizeRichText(dto.bodyAr), bodyEn: sanitizeRichText(dto.bodyEn), eventDate: dto.eventDate ? dto.eventDate.slice(0, 10) : null }),
    );
    await this.audit.log({ category: 'committees', action: 'update', description: `إضافة نشاط إلى لجنة ${c.nameAr}: ${saved.titleAr}`, actorId: actor.id, entityType: 'committee_activities', entityId: saved.id });
    return this.presentActivity(saved);
  }

  async updateActivity(id: number, dto: UpdateActivityDto, actor: AuthUser) {
    const a = await this.activities.findOne({ where: { id } });
    if (!a) throw new NotFoundException('النشاط غير موجود');
    if (dto.kind !== undefined) a.kind = dto.kind as ActivityKind;
    if (dto.titleAr !== undefined) a.titleAr = dto.titleAr.trim();
    if (dto.titleEn !== undefined) a.titleEn = dto.titleEn?.trim() || null;
    if (dto.bodyAr !== undefined) a.bodyAr = sanitizeRichText(dto.bodyAr);
    if (dto.bodyEn !== undefined) a.bodyEn = sanitizeRichText(dto.bodyEn);
    if (dto.eventDate !== undefined) a.eventDate = dto.eventDate ? dto.eventDate.slice(0, 10) : null;
    const saved = await this.activities.save(a);
    await this.audit.log({ category: 'committees', action: 'update', description: `تعديل نشاط لجنة: ${saved.titleAr}`, actorId: actor.id, entityType: 'committee_activities', entityId: id });
    return this.presentActivity(saved);
  }

  async removeActivity(id: number, actor: AuthUser) {
    const a = await this.activities.findOne({ where: { id } });
    if (!a) throw new NotFoundException('النشاط غير موجود');
    await this.activities.delete({ id });
    await this.audit.log({ category: 'committees', action: 'update', description: `حذف نشاط لجنة: ${a.titleAr}`, actorId: actor.id, entityType: 'committee_activities', entityId: id });
    return { deleted: 1 };
  }

  // ---------------------------------------------------------------- admin: linked news
  /** Find news by title to attach (already linked ones are left out). */
  async searchNews(committeeId: number, q: string) {
    await this.mustFind(committeeId);
    const linked = await this.links.newsIdsOf('committee', committeeId);
    const qb = this.news.createQueryBuilder('n').select(['n.id', 'n.title', 'n.publishAt']).orderBy('n.publishAt', 'DESC', 'NULLS LAST').addOrderBy('n.id', 'DESC').take(10);
    if (q.trim()) qb.andWhere('n.title ILIKE :like', { like: `%${escapeLike(q.trim())}%` });
    if (linked.length) qb.andWhere('n.id NOT IN (:...linked)', { linked });
    return (await qb.getMany()).map((n) => ({ id: n.id, title: n.title, publishAt: n.publishAt }));
  }

  async linkNews(committeeId: number, newsIds: number[], actor: AuthUser) {
    const c = await this.mustFind(committeeId);
    const found = await this.news.find({ where: { id: In(newsIds) }, select: ['id'] });
    await this.links.link('committee', committeeId, found.map((n) => Number(n.id)));
    await this.audit.log({ category: 'committees', action: 'update', description: `ربط أخبار باللجنة: ${c.nameAr}`, actorId: actor.id, entityType: 'committees', entityId: committeeId, details: { newsIds } });
    return { linked: found.length };
  }

  async unlinkNews(committeeId: number, newsIds: number[], actor: AuthUser) {
    const c = await this.mustFind(committeeId);
    await this.links.unlink('committee', committeeId, newsIds);
    await this.audit.log({ category: 'committees', action: 'update', description: `فك ربط أخبار عن اللجنة: ${c.nameAr}`, actorId: actor.id, entityType: 'committees', entityId: committeeId, details: { newsIds } });
    return { unlinked: newsIds.length };
  }

  // ---------------------------------------------------------------- public (active only)
  private card(c: Committee, en: boolean) {
    return {
      id: c.id, kind: c.kind, name: (en && c.nameEn) || c.nameAr, summary: (en && c.summaryEn) || c.summaryAr || '', chairName: (en && c.chairNameEn) || c.chairNameAr || '',
      tags: tags((en && c.activityTagsEn) || c.activityTagsAr), logoUrl: this.storage.url(c.logo),
    };
  }

  /** Sector committees with the "find my committee by business activity" search. Women kind has its own page. */
  async publicList(lang: string, q?: string) {
    const qb = this.repo.createQueryBuilder('c').where('c.isActive = true').andWhere('c.kind = :kind', { kind: 'sector' });
    if (q?.trim()) {
      const like = `%${escapeLike(q.trim())}%`;
      qb.andWhere(new Brackets((b) => b.where('c.nameAr ILIKE :like', { like }).orWhere('c.nameEn ILIKE :like', { like }).orWhere('c.activityTagsAr ILIKE :like', { like }).orWhere('c.activityTagsEn ILIKE :like', { like }).orWhere('c.summaryAr ILIKE :like', { like })));
    }
    qb.orderBy('c.sortOrder', 'ASC').addOrderBy('c.id', 'ASC');
    return (await qb.getMany()).map((c) => this.card(c, lang === 'en'));
  }

  /** The businesswomen committee page (first active committee of kind "women"). */
  async publicWomen(lang: string) {
    const c = await this.repo.findOne({ where: { kind: 'women', isActive: true }, order: { sortOrder: 'ASC', id: 'ASC' } });
    if (!c) throw new NotFoundException('اللجنة غير موجودة');
    return this.detail(c, lang);
  }

  async publicOne(id: number, lang: string) {
    const c = await this.repo.findOne({ where: { id, isActive: true } });
    if (!c) throw new NotFoundException('اللجنة غير موجودة');
    return this.detail(c, lang);
  }

  private async detail(c: Committee, lang: string) {
    const en = lang === 'en';
    const [members, acts, newsIds] = await Promise.all([
      this.members.find({ where: { committeeId: c.id }, order: { sortOrder: 'ASC', id: 'ASC' } }),
      this.activities.find({ where: { committeeId: c.id }, order: { eventDate: 'DESC', id: 'DESC' } }),
      this.links.newsIdsOf('committee', c.id),
    ]);
    const rank = (r: string) => MEMBER_ROLES.indexOf(r as MemberRole);
    const t = today();
    const act = (a: CommitteeActivity) => ({ id: a.id, kind: a.kind, title: (en && a.titleEn) || a.titleAr, body: (en && a.bodyEn) || a.bodyAr || '', eventDate: a.eventDate, upcoming: !!a.eventDate && a.eventDate >= t });
    let newsList: unknown[] = [];
    if (newsIds.length) {
      const qb = this.news.createQueryBuilder('n').select(['n.id', 'n.title', 'n.excerpt', 'n.images', 'n.publishAt']).where('n.id IN (:...newsIds)', { newsIds });
      applyEligibility(qb, 'n', { lang: en ? 'en' : 'ar', authenticated: false });
      qb.orderBy('n.publishAt', 'DESC').addOrderBy('n.id', 'DESC').take(30);
      newsList = (await qb.getMany()).map((n) => ({ id: n.id, title: n.title, excerpt: n.excerpt ?? '', image: this.storage.url((n.images ?? [])[0] ?? null), publishAt: n.publishAt }));
    }
    const byKind = (k: ActivityKind) => acts.filter((a) => a.kind === k).map(act);
    return {
      ...this.card(c, en), duties: (en && c.dutiesEn) || c.dutiesAr || '',
      members: members.sort((a, b) => rank(a.role) - rank(b.role)).map((m) => ({ id: m.id, role: m.role, name: (en && m.nameEn) || m.nameAr, title: (en && m.titleEn) || m.titleAr || '', photoUrl: this.storage.url(m.photo) })),
      meetings: [...byKind('meeting'), ...byKind('visit')].sort((a, b) => (b.eventDate ?? '').localeCompare(a.eventDate ?? '')),
      recommendations: byKind('recommendation'),
      initiatives: byKind('initiative'),
      news: newsList,
    };
  }
}
