import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CC } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { sanitizeRichText } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { ContentStore, Rec, isActive, pick, s, sortOf } from '../content/content.store';
import { by, filterByCf, matches, pageRows } from '../content/mem';
import { CreatePageDto, PagesAdminQueryDto, UpdatePageDto } from './pages.dto';

/** Static pages (about the chamber ...): news rows of the main category PAGE. Title and body are the news ones; slug, English texts, order, visibility in `extra`. */
@Injectable()
export class PagesService {
  constructor(
    private readonly store: ContentStore,
    private readonly audit: AuditService,
  ) {}

  private view(r: Rec) {
    return {
      id: r.id, slug: s(r.x.slug), titleAr: r.title, titleEn: s(r.x.titleEn), bodyAr: r.body ?? '', bodyEn: s(r.x.bodyEn),
      sortOrder: sortOf(r), isActive: isActive(r), showInFooter: r.x.showInFooter === true, createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }

  async list(q: PagesAdminQueryDto) {
    let rows = (await this.store.list(CC.PAGE)).map((r) => this.view(r));
    if (q.q) rows = rows.filter((p) => matches([p.titleAr, p.titleEn, p.slug], q.q!));
    rows = filterByCf(rows, q.cf, { titleAr: (p) => [p.titleAr], titleEn: (p) => [p.titleEn], slug: (p) => [p.slug] });
    rows.sort(by((p) => p.sortOrder, (p) => p.id));
    return pageRows(rows, q, (p) => p);
  }

  private async assertSlugFree(slug: string, exceptId?: number) {
    const hit = (await this.store.list(CC.PAGE)).find((r) => r.x.slug === slug);
    if (hit && hit.id !== exceptId) throw new ConflictException('هذا الرابط المختصر مستخدم لصفحة أخرى');
  }

  async create(dto: CreatePageDto, actor: AuthUser) {
    await this.assertSlugFree(dto.slug);
    const r = await this.store.create(CC.PAGE, {
      title: dto.titleAr.trim(), body: sanitizeRichText(dto.bodyAr),
      x: { slug: dto.slug, titleEn: dto.titleEn?.trim() || null, bodyEn: sanitizeRichText(dto.bodyEn), sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true, showInFooter: dto.showInFooter ?? false },
    });
    await this.audit.log({ category: 'pages', action: 'create', description: `إضافة صفحة: ${r.title}`, actorId: actor.id, entityType: 'site_pages', entityId: r.id });
    return this.view(r);
  }

  async update(id: number, dto: UpdatePageDto, actor: AuthUser) {
    const cur = await this.store.get(id, CC.PAGE);
    if (!cur) throw new NotFoundException('الصفحة غير موجودة');
    if (dto.slug !== undefined && dto.slug !== cur.x.slug) await this.assertSlugFree(dto.slug, id);
    const r = await this.store.update(id, {
      title: dto.titleAr?.trim(), body: dto.bodyAr === undefined ? undefined : sanitizeRichText(dto.bodyAr),
      x: {
        slug: dto.slug, titleEn: dto.titleEn === undefined ? undefined : dto.titleEn?.trim() || null, bodyEn: dto.bodyEn === undefined ? undefined : sanitizeRichText(dto.bodyEn),
        sortOrder: dto.sortOrder, isActive: dto.isActive, showInFooter: dto.showInFooter,
      },
    });
    await this.audit.log({ category: 'pages', action: 'update', description: `تعديل صفحة: ${r!.title}`, actorId: actor.id, entityType: 'site_pages', entityId: id });
    return this.view(r!);
  }

  async remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(CC.PAGE);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض الصفحات غير موجودة'); // nothing is deleted
    await this.store.remove(unique);
    await this.audit.log({ category: 'pages', action: 'delete', description: `حذف ${rows.length} صفحة`, actorId: actor.id, entityType: 'site_pages', details: { ids: unique }, changes: removedChanges('site_pages', rows.map((r) => this.view(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public (active pages only)
  /** Links for the footer / sitemap: no bodies. */
  async publicList(lang: string, footerOnly: boolean) {
    return (await this.store.list(CC.PAGE))
      .filter((r) => isActive(r) && (!footerOnly || r.x.showInFooter === true))
      .sort(by((r) => sortOf(r), (r) => r.id))
      .map((r) => ({ id: r.id, slug: s(r.x.slug), title: pick(r.title, r.x.titleEn, lang === 'en') }));
  }

  async publicOne(slug: string, lang: string) {
    const r = (await this.store.list(CC.PAGE)).find((x) => x.x.slug === slug && isActive(x));
    if (!r) throw new NotFoundException('الصفحة غير موجودة');
    const en = lang === 'en';
    return { id: r.id, slug: s(r.x.slug), title: pick(r.title, r.x.titleEn, en), body: pick(r.body, r.x.bodyEn, en) };
  }
}
