import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';
import { Trainer } from './trainer.entity';

export const COURSE_KINDS = ['course', 'workshop', 'seminar', 'diploma'] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];

/**
 * A training course. "Current" vs "archive" is never stored: it is computed from the dates when the list is queried
 * (a course is archived once its last day, `endDate` or else `startDate`, has passed), so nothing has to run on a schedule.
 * The registration status (open / full / closed) is computed from the dates, the capacity and `registrationClosed`.
 * `topicsAr/En` hold one topic per line.
 */
@Entity('courses')
@Index('idx_courses_dates', ['startDate', 'endDate'])
@Index('idx_courses_trainer', ['trainerId'])
export class Course extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20, default: 'course' })
  kind: CourseKind;

  @Column({ name: 'name_ar', length: 255 })
  nameAr: string;
  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn: string | null;

  /** subject area (used by the archive search) */
  @Column({ name: 'field_ar', type: 'varchar', length: 150, nullable: true })
  fieldAr: string | null;
  @Column({ name: 'field_en', type: 'varchar', length: 150, nullable: true })
  fieldEn: string | null;

  @Column({ name: 'topics_ar', type: 'text', nullable: true })
  topicsAr: string | null;
  @Column({ name: 'topics_en', type: 'text', nullable: true })
  topicsEn: string | null;

  /** target audience */
  @Column({ name: 'audience_ar', type: 'varchar', length: 255, nullable: true })
  audienceAr: string | null;
  @Column({ name: 'audience_en', type: 'varchar', length: 255, nullable: true })
  audienceEn: string | null;

  @Column({ name: 'trainer_id', type: 'bigint', nullable: true })
  trainerId: number | null;
  @ManyToOne(() => Trainer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'trainer_id' })
  trainer?: Trainer | null;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  /** total training hours */
  @Column({ type: 'int', nullable: true })
  hours: number | null;

  @Column({ name: 'location_ar', type: 'varchar', length: 255, nullable: true })
  locationAr: string | null;
  @Column({ name: 'location_en', type: 'varchar', length: 255, nullable: true })
  locationEn: string | null;

  /** free text (fees are not final yet), e.g. "150,000 ل.س" or "مجاني" */
  @Column({ name: 'fee_ar', type: 'varchar', length: 150, nullable: true })
  feeAr: string | null;
  @Column({ name: 'fee_en', type: 'varchar', length: 150, nullable: true })
  feeEn: string | null;

  /** max participants; empty = unlimited */
  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  /** the training officer closed registration by hand */
  @Column({ name: 'registration_closed', type: 'boolean', default: false })
  registrationClosed: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
