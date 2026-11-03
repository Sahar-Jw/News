import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

export const DOCUMENT_KINDS = ['circular', 'decision', 'law', 'guide', 'library'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Official documents (decisions, circulars) and the digital library. Every record owns exactly one PDF. */
@Entity('documents')
@Index('idx_documents_kind_date', ['kind', 'docDate'])
export class Document extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 30 })
  kind: DocumentKind;

  /** official number, e.g. "12/2026" (free text) */
  @Column({ name: 'doc_number', type: 'varchar', length: 50, nullable: true })
  docNumber: string | null;

  @Column({ name: 'title_ar', length: 255 })
  titleAr: string;

  @Column({ name: 'title_en', type: 'varchar', length: 255, nullable: true })
  titleEn: string | null;

  @Column({ name: 'summary_ar', type: 'text', nullable: true })
  summaryAr: string | null;

  @Column({ name: 'summary_en', type: 'text', nullable: true })
  summaryEn: string | null;

  /** issuing body, e.g. "Chamber board" / "Ministry of Economy" (free text, filterable on the public page) */
  @Column({ name: 'issuer_ar', type: 'varchar', length: 150, nullable: true })
  issuerAr: string | null;

  @Column({ name: 'issuer_en', type: 'varchar', length: 150, nullable: true })
  issuerEn: string | null;

  /** date of the document itself (not of the upload), YYYY-MM-DD */
  @Column({ name: 'doc_date', type: 'date', nullable: true })
  docDate: string | null;

  /** relative storage path of the PDF */
  @Column({ type: 'varchar', length: 500 })
  file: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
