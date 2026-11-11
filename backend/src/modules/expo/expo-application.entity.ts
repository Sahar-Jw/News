import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const APPLICATION_KINDS = ['exhibitor', 'visitor', 'info'] as const;
/** exhibitor form: kind of stand / participation */
export const BOOTH_TYPES = ['equipped', 'space', 'collective', 'sponsor', 'other'] as const;
/** visitor form: why the person is interested in the expo */
export const VISIT_INTERESTS = ['sourcing', 'partnerships', 'products', 'programme', 'other'] as const;
/** information request: what it is about */
export const INQUIRY_TYPES = ['general', 'exhibitor', 'visitor', 'sponsorship', 'media', 'other'] as const;
export const APPLICATION_STATUSES = ['new', 'in_review', 'approved', 'rejected'] as const;

/** A request sent from the EXPO site: stand request, visitor registration or an information request. */
@Entity('expo_applications')
@Index('idx_expo_applications_kind', ['kind', 'status'])
export class ExpoApplication {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20 })
  kind: string;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: string;

  @Column({ length: 150 })
  name: string;
  @Column({ type: 'varchar', length: 190, nullable: true })
  company: string | null;
  /** stored lower-case */
  @Column({ length: 190 })
  email: string;
  @Column({ length: 30 })
  phone: string;
  @Column({ type: 'varchar', length: 150, nullable: true })
  sector: string | null;
  /** stand size / interest / free text */
  @Column({ type: 'text', nullable: true })
  message: string | null;
  /** job title of the contact person / visitor */
  @Column({ name: 'job_title', type: 'varchar', length: 150, nullable: true })
  jobTitle: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;
  /** products or services the company wants to exhibit */
  @Column({ type: 'text', nullable: true })
  products: string | null;
  /** requested stand area, free text (e.g. "24 m²") */
  @Column({ type: 'varchar', length: 40, nullable: true })
  area: string | null;
  @Column({ name: 'participation_type', type: 'varchar', length: 20, nullable: true })
  participationType: string | null;
  @Column({ type: 'varchar', length: 20, nullable: true })
  interest: string | null;
  @Column({ name: 'inquiry_type', type: 'varchar', length: 20, nullable: true })
  inquiryType: string | null;
  /** optional company profile (PDF / Word) of an exhibitor request */
  @Column({ name: 'profile_file', type: 'varchar', length: 255, nullable: true })
  profileFile: string | null;
  /** internal note of the EXPO team */
  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
