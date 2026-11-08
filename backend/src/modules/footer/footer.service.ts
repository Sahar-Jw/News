import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { SaveFooterDto } from './footer.dto';
import { FooterGroup, FooterKind, FooterLink } from './footer.entity';

@Injectable()
export class FooterService {
  constructor(
    @InjectRepository(FooterGroup) private readonly groups: Repository<FooterGroup>,
    @InjectRepository(FooterLink) private readonly links: Repository<FooterLink>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly audit: AuditService,
  ) {}

  private async load() {
    const [groups, links] = await Promise.all([
      this.groups.find({ order: { sortOrder: 'ASC', id: 'ASC' } }),
      this.links.find({ order: { sortOrder: 'ASC', id: 'ASC' } }),
    ]);
    return { groups, links };
  }

  /** Everything, including hidden groups and links (the editor). */
  async adminTree() {
    const { groups, links } = await this.load();
    return {
      groups: groups.map((g) => ({
        id: g.id, titleAr: g.titleAr, titleEn: g.titleEn ?? '', kind: g.kind, columns: g.columns, isActive: g.isActive,
        items: links.filter((l) => Number(l.groupId) === Number(g.id)).map((l) => ({ id: l.id, titleAr: l.titleAr, titleEn: l.titleEn ?? '', url: l.url, isActive: l.isActive, newTab: l.newTab })),
      })),
    };
  }

  /** Replaces the stored footer links with the submitted ones (same order), in one transaction. */
  async save(dto: SaveFooterDto, actor: AuthUser) {
    await this.ds.transaction(async (m) => {
      await m.createQueryBuilder().delete().from(FooterLink).execute();
      await m.createQueryBuilder().delete().from(FooterGroup).execute();
      for (const [gi, g] of dto.groups.entries()) {
        const saved = await m.save(m.create(FooterGroup, { titleAr: g.titleAr.trim(), titleEn: g.titleEn?.trim() || null, kind: g.kind as FooterKind, columns: g.columns, sortOrder: gi, isActive: g.isActive ?? true }));
        const rows = g.items.map((i, ii) => m.create(FooterLink, { groupId: saved.id, titleAr: i.titleAr.trim(), titleEn: i.titleEn?.trim() || null, url: i.url.trim(), sortOrder: ii, isActive: i.isActive ?? true, newTab: i.newTab ?? false }));
        if (rows.length) await m.save(rows);
      }
    });
    const n = dto.groups.reduce((c, g) => c + g.items.length, 0);
    await this.audit.log({ category: 'footer', action: 'update', description: `تعديل روابط التذييل (${dto.groups.length} مجموعة، ${n} رابط)`, actorId: actor.id, entityType: 'footer_groups', details: { groups: dto.groups.map((g) => g.titleAr) } });
    return this.adminTree();
  }

  /** What the site shows: visible groups that still have at least one visible link, in the requested language. */
  async publicTree(lang: string) {
    const en = lang === 'en';
    const { groups, links } = await this.load();
    return groups
      .filter((g) => g.isActive)
      .map((g) => ({
        id: g.id, kind: g.kind, columns: g.columns, title: (en && g.titleEn) || g.titleAr,
        items: links.filter((l) => l.isActive && Number(l.groupId) === Number(g.id)).map((l) => ({ id: l.id, title: (en && l.titleEn) || l.titleAr, url: l.url, newTab: l.newTab })),
      }))
      .filter((g) => g.items.length > 0);
  }
}
