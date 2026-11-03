import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/** A dropdown of the site's main menu (e.g. "About the chamber"). Edited from Settings -> Main menu. */
@Entity('nav_groups')
export class NavGroup extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'title_ar', length: 150 })
  titleAr: string;

  /** optional: the Arabic name is shown when empty */
  @Column({ name: 'title_en', type: 'varchar', length: 150, nullable: true })
  titleEn: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

/** One link inside a dropdown. `url` is a site path ("/news", "/pages/view?slug=about") or a full http(s) address. */
@Entity('nav_items')
@Index('idx_nav_items_group', ['groupId', 'sortOrder'])
export class NavItem extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'group_id', type: 'bigint' })
  groupId: number;

  @ManyToOne(() => NavGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: NavGroup;

  @Column({ name: 'title_ar', length: 150 })
  titleAr: string;

  @Column({ name: 'title_en', type: 'varchar', length: 150, nullable: true })
  titleEn: string | null;

  @Column({ length: 500 })
  url: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'new_tab', type: 'boolean', default: false })
  newTab: boolean;
}
