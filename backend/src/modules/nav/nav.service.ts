import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { SaveNavDto } from './nav.dto';
import { NavGroup, NavItem } from './nav.entity';

type LinkLike = { url: string; isActive?: boolean; newTab?: boolean; custom?: boolean };
/** identity of a link: its address and how it opens. The names (Arabic / English) are the part the editor MAY change. */
const linkKey = (i: LinkLike) => [i.url.trim(), i.isActive ?? true, i.newTab ?? false].join('\u0001');

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
        id: g.id, titleAr: g.titleAr, titleEn: g.titleEn ?? '', isActive: g.isActive, single: g.single,
        items: items.filter((i) => Number(i.groupId) === Number(g.id)).map((i) => ({ id: i.id, titleAr: i.titleAr, titleEn: i.titleEn ?? '', url: i.url, isActive: i.isActive, newTab: i.newTab, custom: i.custom })),
      })),
    };
  }

  /**
   * Replaces the stored menu with the submitted one (same order), in one transaction. The dropdowns can be added, renamed, reordered and
   * deleted, and the links can be renamed, moved between them and reordered, but the links made by a page's migration cannot be added, deleted or re-pointed here;
   * standalone / custom links added from the editor are free to add, edit and delete.
   */
  async save(dto: SaveNavDto, actor: AuthUser) {
    // standalone links must hold exactly one link
    if (dto.groups.some((g) => g.single && g.items.length !== 1)) throw new BadRequestException('الرابط المستقل يحتوي على رابط واحد فقط.');
    // the links made by pages (not custom) are protected as before; custom links (added here) are free: they can be added, edited and deleted
    const stored = (await this.items.find({ where: { custom: false } })).map(linkKey).sort();
    const sent = dto.groups.flatMap((g) => g.items).filter((i) => !i.custom).map(linkKey).sort();
    if (stored.length !== sent.length || stored.some((k, i) => k !== sent[i])) {
      throw new BadRequestException('لا يمكن إضافة الروابط أو حذفها أو تغيير عنوانها من هنا، ويمكن تعديل أسمائها ونقلها بين القوائم وترتيبها. انقل روابط القائمة قبل حذفها.');
    }
    await this.ds.transaction(async (m) => {
      await m.createQueryBuilder().delete().from(NavItem).execute();
      await m.createQueryBuilder().delete().from(NavGroup).execute();
      for (const [gi, g] of dto.groups.entries()) {
        const saved = await m.save(m.create(NavGroup, { titleAr: g.titleAr.trim(), titleEn: g.titleEn?.trim() || null, sortOrder: gi, isActive: g.isActive ?? true, single: g.single ?? false }));
        const rows = g.items.map((i, ii) =>
          m.create(NavItem, { groupId: saved.id, titleAr: i.titleAr.trim(), titleEn: i.titleEn?.trim() || null, url: i.url.trim(), sortOrder: ii, isActive: i.isActive ?? true, newTab: i.newTab ?? false, custom: i.custom ?? false }),
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
        single: g.single,
        title: (en && g.titleEn) || g.titleAr,
        items: items.filter((i) => i.isActive && Number(i.groupId) === Number(g.id)).map((i) => ({ id: i.id, title: (en && i.titleEn) || i.titleAr, url: i.url, newTab: i.newTab })),
      }))
      .filter((g) => g.items.length > 0);
  }
}
