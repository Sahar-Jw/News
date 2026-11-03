import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { SaveNavDto } from './nav.dto';
import { NavGroup, NavItem } from './nav.entity';

@Injectable()
export class NavService {
  constructor(
    @InjectRepository(NavGroup) private readonly groups: Repository<NavGroup>,
    @InjectRepository(NavItem) private readonly items: Repository<NavItem>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly audit: AuditService,
  ) {}

  private async load() {
    const [groups, items] = await Promise.all([
      this.groups.find({ order: { sortOrder: 'ASC', id: 'ASC' } }),
      this.items.find({ order: { sortOrder: 'ASC', id: 'ASC' } }),
    ]);
    return { groups, items };
  }

  /** Everything, including hidden groups and links (the editor). */
  async adminTree() {
    const { groups, items } = await this.load();
    return {
      groups: groups.map((g) => ({
        id: g.id, titleAr: g.titleAr, titleEn: g.titleEn ?? '', isActive: g.isActive,
        items: items.filter((i) => Number(i.groupId) === Number(g.id)).map((i) => ({ id: i.id, titleAr: i.titleAr, titleEn: i.titleEn ?? '', url: i.url, isActive: i.isActive, newTab: i.newTab })),
      })),
    };
  }

  /** Replaces the stored menu with the submitted one (same order), in one transaction. */
  async save(dto: SaveNavDto, actor: AuthUser) {
    await this.ds.transaction(async (m) => {
      await m.createQueryBuilder().delete().from(NavItem).execute();
      await m.createQueryBuilder().delete().from(NavGroup).execute();
      for (const [gi, g] of dto.groups.entries()) {
        const saved = await m.save(m.create(NavGroup, { titleAr: g.titleAr.trim(), titleEn: g.titleEn?.trim() || null, sortOrder: gi, isActive: g.isActive ?? true }));
        const rows = g.items.map((i, ii) =>
          m.create(NavItem, { groupId: saved.id, titleAr: i.titleAr.trim(), titleEn: i.titleEn?.trim() || null, url: i.url.trim(), sortOrder: ii, isActive: i.isActive ?? true, newTab: i.newTab ?? false }),
        );
        if (rows.length) await m.save(rows);
      }
    });
    const links = dto.groups.reduce((n, g) => n + g.items.length, 0);
    await this.audit.log({ category: 'nav', action: 'update', description: `تعديل القائمة الرئيسية (${dto.groups.length} قائمة، ${links} رابط)`, actorId: actor.id, entityType: 'nav_groups', details: { groups: dto.groups.map((g) => g.titleAr) } });
    return this.adminTree();
  }

  /** What the site shows: visible groups that still have at least one visible link, in the requested language. */
  async publicTree(lang: string) {
    const en = lang === 'en';
    const { groups, items } = await this.load();
    return groups
      .filter((g) => g.isActive)
      .map((g) => ({
        id: g.id,
        title: (en && g.titleEn) || g.titleAr,
        items: items.filter((i) => i.isActive && Number(i.groupId) === Number(g.id)).map((i) => ({ id: i.id, title: (en && i.titleEn) || i.titleAr, url: i.url, newTab: i.newTab })),
      }))
      .filter((g) => g.items.length > 0);
  }
}
