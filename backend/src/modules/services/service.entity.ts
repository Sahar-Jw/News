import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

export const SERVICE_KINDS = ['membership', 'certificate', 'attestation', 'origin', 'consulting', 'other'] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

/**
 * A chamber service. One table feeds the One-Stop page now and the Services page later (same data, two views),
 * so fees and documents are entered once. Arabic is required; English is optional (the Arabic text is shown when empty).
 * `documentsAr/En` and `stepsAr/En` hold one item per line.
 */
@Entity('services')
@Index('idx_services_active_order', ['isActive', 'sortOrder'])
@Index('idx_services_kind', ['kind'])
export class ChamberService extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 30, default: 'other' })
  kind: ServiceKind;

  @Column({ name: 'name_ar', length: 255 })
  nameAr: string;
  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn: string | null;

  @Column({ name: 'description_ar', type: 'text', nullable: true })
  descriptionAr: string | null;
  @Column({ name: 'description_en', type: 'text', nullable: true })
  descriptionEn: string | null;

  /** who the service is for */
  @Column({ name: 'audience_ar', type: 'varchar', length: 500, nullable: true })
  audienceAr: string | null;
  @Column({ name: 'audience_en', type: 'varchar', length: 500, nullable: true })
  audienceEn: string | null;

  /** required documents, one per line */
  @Column({ name: 'documents_ar', type: 'text', nullable: true })
  documentsAr: string | null;
  @Column({ name: 'documents_en', type: 'text', nullable: true })
  documentsEn: string | null;

  /** steps, one per line */
  @Column({ name: 'steps_ar', type: 'text', nullable: true })
  stepsAr: string | null;
  @Column({ name: 'steps_en', type: 'text', nullable: true })
  stepsEn: string | null;

  @Column({ name: 'location_ar', type: 'varchar', length: 255, nullable: true })
  locationAr: string | null;
  @Column({ name: 'location_en', type: 'varchar', length: 255, nullable: true })
  locationEn: string | null;

  /** responsible department */
  @Column({ name: 'department_ar', type: 'varchar', length: 150, nullable: true })
  departmentAr: string | null;
  @Column({ name: 'department_en', type: 'varchar', length: 150, nullable: true })
  departmentEn: string | null;

  @Column({ name: 'duration_ar', type: 'varchar', length: 100, nullable: true })
  durationAr: string | null;
  @Column({ name: 'duration_en', type: 'varchar', length: 100, nullable: true })
  durationEn: string | null;

  /** free text (amounts are not final yet), e.g. "50,000 ل.س" or "مجاني" */
  @Column({ name: 'fee_ar', type: 'varchar', length: 150, nullable: true })
  feeAr: string | null;
  @Column({ name: 'fee_en', type: 'varchar', length: 150, nullable: true })
  feeEn: string | null;

  /** link to the downloadable form (optional) */
  @Column({ name: 'form_url', type: 'varchar', length: 500, nullable: true })
  formUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
