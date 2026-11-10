import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

export const TRAINER_APPLICATION_STATUSES = ['new', 'in_review', 'accepted', 'rejected'] as const;
export type TrainerApplicationStatus = (typeof TRAINER_APPLICATION_STATUSES)[number];

export interface TrainerApplicationFile {
  name: string;
  /** relative path under private/trainers/ */
  path: string;
  size: number;
}

/** A request to become a trainer of the Training Center. The CV and certificates live under private/trainers/ (registrations.read needed). */
@Entity('trainer_applications')
@Index('idx_trainer_applications_status', ['status', 'createdAt'])
export class TrainerApplication extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  /** three-part name */
  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({ length: 30 })
  phone: string;

  /** stored lower-case */
  @Column({ length: 190 })
  email: string;

  @Column({ type: 'text' })
  specializations: string;

  @Column({ name: 'training_fields', type: 'text' })
  trainingFields: string;

  @Column({ length: 255 })
  qualification: string;

  /** scientific and training experience */
  @Column({ type: 'text' })
  experience: string;

  /** the courses and programmes the trainer can deliver */
  @Column({ type: 'text' })
  programs: string;

  @Column({ type: 'text' })
  bio: string;

  @Column({ name: 'cv_path', length: 500 })
  cvPath: string;

  @Column({ name: 'cv_name', length: 255 })
  cvName: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  certificates: TrainerApplicationFile[];

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: TrainerApplicationStatus;

  /** internal notes of the staff member: never shown to the applicant */
  @Column({ name: 'staff_notes', type: 'text', nullable: true })
  staffNotes: string | null;
}
