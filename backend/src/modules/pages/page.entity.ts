import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/** Static, editable pages (about the chamber, vision, ...). Shown at /pages/view?slug=<slug>. */
@Entity('site_pages')
@Index('uq_site_pages_slug', ['slug'], { unique: true })
export class SitePage extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  /** lowercase letters, digits and dashes, e.g. "about" */
  @Column({ length: 100 })
  slug: string;

  @Column({ name: 'title_ar', length: 255 })
  titleAr: string;

  @Column({ name: 'title_en', type: 'varchar', length: 255, nullable: true })
  titleEn: string | null;

  /** sanitized HTML */
  @Column({ name: 'body_ar', type: 'text', nullable: true })
  bodyAr: string | null;

  @Column({ name: 'body_en', type: 'text', nullable: true })
  bodyEn: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** also listed in the site footer */
  @Column({ name: 'show_in_footer', type: 'boolean', default: false })
  showInFooter: boolean;
}
