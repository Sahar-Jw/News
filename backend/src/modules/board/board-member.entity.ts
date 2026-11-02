import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/** Positions in display order (the public page groups members by these, top to bottom). */
export const BOARD_POSITIONS = ['president', 'vice_president', 'secretary', 'treasurer', 'member'] as const;
export type BoardPosition = (typeof BOARD_POSITIONS)[number];

/** A member of the chamber's board of directors, with an own public page. */
@Entity('board_members')
export class BoardMember extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 30 })
  position: BoardPosition;

  @Column({ name: 'name_ar', length: 255 })
  nameAr: string;

  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn: string | null;

  /** professional title, e.g. "Chairman of ... company" */
  @Column({ name: 'job_title_ar', type: 'varchar', length: 255, nullable: true })
  jobTitleAr: string | null;

  @Column({ name: 'job_title_en', type: 'varchar', length: 255, nullable: true })
  jobTitleEn: string | null;

  /** sanitized HTML: professional biography */
  @Column({ name: 'bio_ar', type: 'text', nullable: true })
  bioAr: string | null;

  @Column({ name: 'bio_en', type: 'text', nullable: true })
  bioEn: string | null;

  /** sanitized HTML: committees and duties */
  @Column({ name: 'duties_ar', type: 'text', nullable: true })
  dutiesAr: string | null;

  @Column({ name: 'duties_en', type: 'text', nullable: true })
  dutiesEn: string | null;

  /** board term, free text, e.g. "2024 - 2028" */
  @Column({ name: 'term_label', type: 'varchar', length: 100, nullable: true })
  termLabel: string | null;

  /** relative storage path of the picture */
  @Column({ type: 'varchar', length: 500, nullable: true })
  photo: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
