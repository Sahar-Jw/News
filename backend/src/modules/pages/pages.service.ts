import { Injectable, NotFoundException } from '@nestjs/common';
import { CC } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { sanitizeRichText } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { ContentStore, Rec, isActive, pick, s, sortOf } from '../content/content.store';
import { by, filterByCf, matches, pageRows } from '../content/mem';
import { PagesAdminQueryDto, UpdatePageDto } from './pages.dto';

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

  private hasBody(value: unknown) {
    return String(value ?? '').replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').trim().length > 0;
  }

  async list(q: PagesAdminQueryDto) {
    let rows = (await this.store.list(CC.PAGE)).filter((r) => r.x.slug === 'about').map((r) => this.view(r));
    if (q.q) rows = rows.filter((p) => matches([p.titleAr, p.titleEn, p.slug], q.q!));
    rows = filterByCf(rows, q.cf, { titleAr: (p) => [p.titleAr], titleEn: (p) => [p.titleEn], slug: (p) => [p.slug] });
    rows.sort(by((p) => p.sortOrder, (p) => p.id));
    return pageRows(rows, q, (p) => p);
  }

  async update(id: number, dto: UpdatePageDto, actor: AuthUser) {
    const cur = await this.store.get(id, CC.PAGE);
    if (!cur || cur.x.slug !== 'about') throw new NotFoundException('الصفحة غير موجودة');
    if (dto.slug !== undefined && dto.slug !== 'about') throw new NotFoundException('لا يمكن تغيير رابط الصفحة الثابتة');
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

  // ---------------------------------------------------------------- public (active pages only)
  /** Links for the footer / sitemap: no bodies. */
  async publicList(lang: string, footerOnly: boolean) {
    return (await this.store.list(CC.PAGE))
      .filter((r) => r.x.slug === 'about' && isActive(r) && (this.hasBody(r.body) || this.hasBody(r.x.bodyEn)) && (!footerOnly || r.x.showInFooter === true))
      .sort(by((r) => sortOf(r), (r) => r.id))
      .map((r) => ({ id: r.id, slug: s(r.x.slug), title: pick(r.title, r.x.titleEn, lang === 'en') }));
  }

  async publicOne(slug: string, lang: string) {
    if (slug !== 'about') throw new NotFoundException('الصفحة غير موجودة');
    const r = (await this.store.list(CC.PAGE)).find((x) => x.x.slug === slug && isActive(x) && (this.hasBody(x.body) || this.hasBody(x.x.bodyEn)));
    if (!r) throw new NotFoundException('الصفحة غير موجودة');
    const en = lang === 'en';
    return { id: r.id, slug: s(r.x.slug), title: pick(r.title, r.x.titleEn, en), body: pick(r.body, r.x.bodyEn, en) };
  }
}
