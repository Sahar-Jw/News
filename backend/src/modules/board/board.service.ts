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
import { News } from '../news/news.entity';
import { applyEligibility } from '../news/news.eligibility';
import { FileStorageService } from '../files/file-storage.service';
import { BOARD_POSITIONS, BoardPosition } from './board-member.entity';
import { BoardAdminQueryDto, CreateBoardMemberDto, UpdateBoardMemberDto } from './board.dto';

/**
 * Board of directors: news rows of the main category BOARD_MEMBER. Name = news title, bio = news body, photo = news image;
 * position, job title, duties, term, order, visibility and the English texts live in `extra`.
 */
@Injectable()
export class BoardService {
  constructor(
    private readonly store: ContentStore,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    @InjectRepository(News) private readonly news: Repository<News>,
    private readonly links: ContentLinksService,
  ) {}

  private view(r: Rec) {
    return {
      id: r.id, position: (r.x.position ?? 'member') as BoardPosition, nameAr: r.title, nameEn: s(r.x.nameEn), jobTitleAr: s(r.x.jobTitleAr), jobTitleEn: s(r.x.jobTitleEn),
      bioAr: r.body ?? '', bioEn: s(r.x.bioEn), dutiesAr: s(r.x.dutiesAr), dutiesEn: s(r.x.dutiesEn), termLabel: s(r.x.termLabel),
      photo: r.images[0] ?? null, photoUrl: this.storage.url(r.images[0] ?? null), sortOrder: sortOf(r), isActive: isActive(r), createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }

  /** the admin / API shape (no raw storage path) */
  present(r: Rec) {
    const { photo, ...v } = this.view(r);
    void photo;
    return v;
  }

  async list(q: BoardAdminQueryDto) {
    let rows = (await this.store.list(CC.BOARD_MEMBER)).map((r) => this.view(r));
    if (q.position) rows = rows.filter((m) => m.position === q.position);
    if (q.q) rows = rows.filter((m) => matches([m.nameAr, m.nameEn, m.jobTitleAr], q.q!));
    rows = filterByCf(rows, q.cf, { nameAr: (m) => [m.nameAr], nameEn: (m) => [m.nameEn], jobTitleAr: (m) => [m.jobTitleAr], termLabel: (m) => [m.termLabel] });
    rows.sort(by((m) => m.sortOrder, (m) => m.id));
    return pageRows(rows, q, ({ photo, ...m }) => (void photo, m));
  }

  async create(dto: CreateBoardMemberDto, photo: Express.Multer.File | undefined, actor: AuthUser) {
    const path = photo ? await this.storage.saveImage(photo, 'board', 1200) : null;
    try {
      const r = await this.store.create(CC.BOARD_MEMBER, {
        title: dto.nameAr.trim(), body: sanitizeRichText(dto.bioAr), images: path ? [path] : [],
        x: {
          position: dto.position, nameEn: dto.nameEn?.trim() || null, jobTitleAr: dto.jobTitleAr?.trim() || null, jobTitleEn: dto.jobTitleEn?.trim() || null,
          bioEn: sanitizeRichText(dto.bioEn), dutiesAr: sanitizeRichText(dto.dutiesAr), dutiesEn: sanitizeRichText(dto.dutiesEn), termLabel: dto.termLabel?.trim() || null,
          sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true,
        },
      });
      await this.audit.log({ category: 'board', action: 'create', description: `إضافة عضو مجلس: ${r.title}`, actorId: actor.id, entityType: 'board_members', entityId: r.id });
      return this.present(r);
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }

  async update(id: number, dto: UpdateBoardMemberDto, photo: Express.Multer.File | undefined, actor: AuthUser) {
    const cur = await this.store.get(id, CC.BOARD_MEMBER);
    if (!cur) throw new NotFoundException('العضو غير موجود');
    const newPath = photo ? await this.storage.saveImage(photo, 'board', 1200) : null;
    const oldPath = cur.images[0] ?? null;
    try {
      const nz = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
      const r = await this.store.update(id, {
        title: dto.nameAr?.trim(), body: dto.bioAr === undefined ? undefined : sanitizeRichText(dto.bioAr), images: newPath ? [newPath] : dto.removePhoto ? [] : undefined,
        x: {
          position: dto.position, nameEn: nz(dto.nameEn), jobTitleAr: nz(dto.jobTitleAr), jobTitleEn: nz(dto.jobTitleEn), bioEn: dto.bioEn === undefined ? undefined : sanitizeRichText(dto.bioEn),
          dutiesAr: dto.dutiesAr === undefined ? undefined : sanitizeRichText(dto.dutiesAr), dutiesEn: dto.dutiesEn === undefined ? undefined : sanitizeRichText(dto.dutiesEn),
          termLabel: nz(dto.termLabel), sortOrder: dto.sortOrder, isActive: dto.isActive,
        },
      });
      await this.audit.log({ category: 'board', action: 'update', description: `تعديل عضو مجلس: ${r!.title}`, actorId: actor.id, entityType: 'board_members', entityId: id });
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
    const all = await this.store.list(CC.BOARD_MEMBER);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض الأعضاء غير موجودين'); // nothing is deleted
    await this.store.remove(unique);
    await this.links.removeAllOf('board_member', unique);
    await this.storage.removeMany(rows.map((r) => r.images[0] ?? null));
    await this.audit.log({ category: 'board', action: 'delete', description: `حذف ${rows.length} من أعضاء المجلس`, actorId: actor.id, entityType: 'board_members', details: { ids: unique }, changes: removedChanges('board_members', rows.map((r) => this.view(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- admin: linked news (shown on the member's page)
  private async mustFind(id: number) {
    const r = await this.store.get(id, CC.BOARD_MEMBER);
    if (!r) throw new NotFoundException('العضو غير موجود');
    return { ...r, nameAr: r.title };
  }

  async linkedNews(id: number) {
    await this.mustFind(id);
    const ids = await this.links.newsIdsOf('board_member', id);
    if (!ids.length) return [];
    const rows = await this.news.find({ where: { id: In(ids) }, select: ['id', 'title', 'publishAt'], order: { publishAt: 'DESC' } });
    return rows.map((n) => ({ id: n.id, title: n.title, publishAt: n.publishAt }));
  }

  /** Find news by title to attach (already linked ones are left out). */
  async searchNews(id: number, q: string) {
    await this.mustFind(id);
    const linked = await this.links.newsIdsOf('board_member', id);
    const qb = this.news.createQueryBuilder('n').select(['n.id', 'n.title', 'n.publishAt']).orderBy('n.publishAt', 'DESC', 'NULLS LAST').addOrderBy('n.id', 'DESC').take(10);
    qb.andWhere('n.mainCategory NOT IN (:...res)', { res: RESERVED_CATEGORY_CODES });
    if (q.trim()) qb.andWhere('n.title ILIKE :like', { like: `%${escapeLike(q.trim())}%` });
    if (linked.length) qb.andWhere('n.id NOT IN (:...linked)', { linked });
    return (await qb.getMany()).map((n) => ({ id: n.id, title: n.title, publishAt: n.publishAt }));
  }

  async linkNews(id: number, newsIds: number[], actor: AuthUser) {
    const m = await this.mustFind(id);
    const found = await this.news.find({ where: { id: In(newsIds), mainCategory: Not(In(RESERVED_CATEGORY_CODES)) }, select: ['id'] });
    await this.links.link('board_member', id, found.map((n) => Number(n.id)));
    await this.audit.log({ category: 'board', action: 'update', description: `ربط أخبار بعضو المجلس: ${m.nameAr}`, actorId: actor.id, entityType: 'board_members', entityId: id, details: { newsIds } });
    return { linked: found.length };
  }

  async unlinkNews(id: number, newsIds: number[], actor: AuthUser) {
    const m = await this.mustFind(id);
    await this.links.unlink('board_member', id, newsIds);
    await this.audit.log({ category: 'board', action: 'update', description: `فك ربط أخبار عن عضو المجلس: ${m.nameAr}`, actorId: actor.id, entityType: 'board_members', entityId: id, details: { newsIds } });
    return { unlinked: newsIds.length };
  }

  // ---------------------------------------------------------------- public (active only)
  private card(r: Rec, en: boolean) {
    const m = this.view(r);
    return { id: m.id, position: m.position, name: pick(m.nameAr, m.nameEn, en), jobTitle: pick(m.jobTitleAr, m.jobTitleEn, en), termLabel: m.termLabel, photoUrl: m.photoUrl };
  }

  /** All active members, already in hierarchy order: position rank first, then the manual order. */
  async publicList(lang: string) {
    const rows = (await this.store.list(CC.BOARD_MEMBER)).filter(isActive).sort(by((r) => sortOf(r), (r) => r.id));
    const rank = (p: unknown) => BOARD_POSITIONS.indexOf(p as BoardPosition);
    return rows.sort((a, b) => rank(a.x.position) - rank(b.x.position)).map((r) => this.card(r, lang === 'en'));
  }

  async publicOne(id: number, lang: string) {
    const r = await this.store.get(id, CC.BOARD_MEMBER);
    if (!r || !isActive(r)) throw new NotFoundException('العضو غير موجود');
    const en = lang === 'en';
    const newsIds = await this.links.newsIdsOf('board_member', id);
    let news: unknown[] = [];
    if (newsIds.length) {
      const qb = this.news.createQueryBuilder('n').select(['n.id', 'n.title', 'n.excerpt', 'n.images', 'n.publishAt']).where('n.id IN (:...newsIds)', { newsIds });
      applyEligibility(qb, 'n', { lang: en ? 'en' : 'ar', authenticated: false });
      qb.orderBy('n.publishAt', 'DESC').addOrderBy('n.id', 'DESC').take(12);
      news = (await qb.getMany()).map((n) => ({ id: n.id, title: n.title, excerpt: n.excerpt ?? '', image: this.storage.url((n.images ?? [])[0] ?? null), publishAt: n.publishAt }));
    }
    return { ...this.card(r, en), bio: pick(r.body, r.x.bioEn, en), duties: pick(r.x.dutiesAr, r.x.dutiesEn, en), news };
  }
}
