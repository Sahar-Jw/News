import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/**
 * links    = a column of the footer (its title and links)
 * official = the "official links" shown inside the contact column
 * legal    = the small links of the bottom bar (privacy, terms, site map ...)
 */
export const FOOTER_KINDS = ['links', 'official', 'legal'] as const;
export type FooterKind = (typeof FOOTER_KINDS)[number];

@Entity('footer_groups')
export class FooterGroup extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'title_ar', length: 150 })
  titleAr: string;

  @Column({ name: 'title_en', type: 'varchar', length: 150, nullable: true })
  titleEn: string | null;

  @Column({ type: 'varchar', length: 10, default: 'links' })
  kind: FooterKind;

  /** 2 = the column is wider and its links are laid out in two lines side by side, so a long list does not make the footer tall */
  @Column({ type: 'smallint', default: 1 })
  columns: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

@Entity('footer_links')
@Index('idx_footer_links_group', ['groupId', 'sortOrder'])
export class FooterLink extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'group_id', type: 'bigint' })
  groupId: number;

  @Column({ name: 'title_ar', length: 150 })
  titleAr: string;

  @Column({ name: 'title_en', type: 'varchar', length: 150, nullable: true })
  titleEn: string | null;

  @Column({ length: 500 })
  url: string;

  @Column({ name: 'new_tab', type: 'boolean', default: false })
  newTab: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
