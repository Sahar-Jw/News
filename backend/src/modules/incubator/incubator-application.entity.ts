import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const APPLICATION_STATUSES = ['new', 'in_review', 'accepted', 'rejected'] as const;
export const PROJECT_STAGES = ['idea', 'prototype', 'launched'] as const;

/** "Submit your project": a request sent from the public Incubator page. */
@Entity('incubator_applications')
@Index('idx_incubator_applications_status', ['status', 'createdAt'])
export class IncubatorApplication {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: string;

  @Column({ name: 'project_name', length: 190 })
  projectName: string;
  @Column({ name: 'founder_name', length: 150 })
  founderName: string;
  /** stored lower-case */
  @Column({ length: 190 })
  email: string;
  @Column({ length: 30 })
  phone: string;
  @Column({ type: 'varchar', length: 150, nullable: true })
  sector: string | null;
  /** idea | prototype | launched */
  @Column({ type: 'varchar', length: 20, nullable: true })
  stage: string | null;
  @Column({ type: 'text' })
  description: string;

  /** internal note of the incubator team */
  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
