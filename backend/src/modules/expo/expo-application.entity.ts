import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const APPLICATION_KINDS = ['exhibitor', 'visitor', 'info'] as const;
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
  /** internal note of the EXPO team */
  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
