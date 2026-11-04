import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

export const PROJECT_STATUSES = ['incubated', 'graduated'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** A project of the Business Incubator: still incubated, or graduated (with its success story). */
@Entity('incubator_projects')
@Index('idx_incubator_projects_status', ['status', 'sortOrder'])
export class IncubatorProject extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20, default: 'incubated' })
  status: ProjectStatus;

  @Column({ name: 'name_ar', length: 190 })
  nameAr: string;
  @Column({ name: 'name_en', type: 'varchar', length: 190, nullable: true })
  nameEn: string | null;

  @Column({ name: 'sector_ar', type: 'varchar', length: 150, nullable: true })
  sectorAr: string | null;
  @Column({ name: 'sector_en', type: 'varchar', length: 150, nullable: true })
  sectorEn: string | null;

  @Column({ name: 'founder_ar', type: 'varchar', length: 150, nullable: true })
  founderAr: string | null;
  @Column({ name: 'founder_en', type: 'varchar', length: 150, nullable: true })
  founderEn: string | null;

  /** what the project does (short) */
  @Column({ name: 'summary_ar', type: 'text', nullable: true })
  summaryAr: string | null;
  @Column({ name: 'summary_en', type: 'text', nullable: true })
  summaryEn: string | null;

  /** success story: shown for graduated projects */
  @Column({ name: 'story_ar', type: 'text', nullable: true })
  storyAr: string | null;
  @Column({ name: 'story_en', type: 'text', nullable: true })
  storyEn: string | null;

  /** year the project joined the incubator */
  @Column({ name: 'joined_year', type: 'int', nullable: true })
  joinedYear: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
