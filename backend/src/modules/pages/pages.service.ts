import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike, sanitizeRichText } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { SitePage } from './page.entity';
import { CreatePageDto, PagesAdminQueryDto, UpdatePageDto } from './pages.dto';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(SitePage) private readonly repo: Repository<SitePage>,
    private readonly audit: AuditService,
  ) {}

  present(p: SitePage) {
    return {
      id: p.id, slug: p.slug, titleAr: p.titleAr, titleEn: p.titleEn ?? '',
      bodyAr: p.bodyAr ?? '', bodyEn: p.bodyEn ?? '',
      sortOrder: p.sortOrder, isActive: p.isActive, showInFooter: p.showInFooter,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    };
  }

  async list(q: PagesAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('p');
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('p.titleAr ILIKE :like', { like }).orWhere('p.titleEn ILIKE :like', { like }).orWhere('p.slug ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { titleAr: 'p.titleAr', titleEn: 'p.titleEn', slug: 'p.slug' });
    qb.orderBy('p.sortOrder', 'ASC').addOrderBy('p.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  private async assertSlugFree(slug: string, exceptId?: number) {
    const hit = await this.repo.findOne({ where: { slug } });
    if (hit && hit.id !== exceptId) throw new ConflictException('هذا الرابط المختصر مستخدم لصفحة أخرى');
  }

  async create(dto: CreatePageDto, actor: AuthUser) {
    await this.assertSlugFree(dto.slug);
    const saved = await this.repo.save(
      this.repo.create({
        slug: dto.slug, titleAr: dto.titleAr.trim(), titleEn: dto.titleEn?.trim() || null,
        bodyAr: sanitizeRichText(dto.bodyAr), bodyEn: sanitizeRichText(dto.bodyEn),
        sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true, showInFooter: dto.showInFooter ?? false,
      }),
    );
    await this.audit.log({ category: 'pages', action: 'create', description: `إضافة صفحة: ${saved.titleAr}`, actorId: actor.id, entityType: 'site_pages', entityId: saved.id });
    return this.present(saved);
  }

  async update(id: number, dto: UpdatePageDto, actor: AuthUser) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('الصفحة غير موجودة');
    if (dto.slug !== undefined && dto.slug !== p.slug) { await this.assertSlugFree(dto.slug, id); p.slug = dto.slug; }
    if (dto.titleAr !== undefined) p.titleAr = dto.titleAr.trim();
    if (dto.titleEn !== undefined) p.titleEn = dto.titleEn?.trim() || null;
    if (dto.bodyAr !== undefined) p.bodyAr = sanitizeRichText(dto.bodyAr);
    if (dto.bodyEn !== undefined) p.bodyEn = sanitizeRichText(dto.bodyEn);
    if (dto.sortOrder !== undefined) p.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) p.isActive = dto.isActive;
    if (dto.showInFooter !== undefined) p.showInFooter = dto.showInFooter;
    const saved = await this.repo.save(p);
    await this.audit.log({ category: 'pages', action: 'update', description: `تعديل صفحة: ${saved.titleAr}`, actorId: actor.id, entityType: 'site_pages', entityId: id });
    return this.present(saved);
  }

  async remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الصفحات غير موجودة'); // nothing is deleted
    await this.repo.delete({ id: In(unique) });
    await this.audit.log({ category: 'pages', action: 'delete', description: `حذف ${rows.length} صفحة`, actorId: actor.id, entityType: 'site_pages', details: { ids: unique }, changes: removedChanges('site_pages', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public (active pages only)
  /** Links for the footer / sitemap: no bodies. */
  async publicList(lang: string, footerOnly: boolean) {
    const rows = await this.repo.find({ where: { isActive: true, ...(footerOnly ? { showInFooter: true } : {}) }, order: { sortOrder: 'ASC', id: 'ASC' } });
    return rows.map((p) => ({ id: p.id, slug: p.slug, title: (lang === 'en' && p.titleEn) || p.titleAr }));
  }

  async publicOne(slug: string, lang: string) {
    const p = await this.repo.findOne({ where: { slug, isActive: true } });
    if (!p) throw new NotFoundException('الصفحة غير موجودة');
    const en = lang === 'en';
    return { id: p.id, slug: p.slug, title: (en && p.titleEn) || p.titleAr, body: (en && p.bodyEn) || p.bodyAr || '' };
  }
}
