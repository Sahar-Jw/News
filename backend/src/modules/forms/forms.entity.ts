import { BeforeInsert, Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';
import type { FieldDef, FormIntegration, FormStatus, FormCategory } from './field-schema';

/**
 * A form built from the dashboard. Fields, statuses, categories and integrations are JSON documents, so adding / editing / deleting a field
 * of any type never needs a schema change. Submissions keep a snapshot of the fields they were answered against.
 */
@Entity('form_definitions')
export class FormDefinition extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index('uq_form_definitions_slug', { unique: true })
  @Column({ length: 80 })
  slug: string;

  @Column({ name: 'title_ar', length: 200 })
  titleAr: string;

  @Column({ name: 'title_en', type: 'varchar', length: 200, nullable: true })
  titleEn: string | null;

  @Column({ name: 'description_ar', type: 'text', nullable: true })
  descriptionAr: string | null;

  @Column({ name: 'description_en', type: 'text', nullable: true })
  descriptionEn: string | null;

  @Column({ name: 'success_ar', type: 'text', nullable: true })
  successAr: string | null;

  @Column({ name: 'success_en', type: 'text', nullable: true })
  successEn: string | null;

  /** open for submissions (the public page still lists / shows a closed form, but refuses to send) */
  @Column({ name: 'is_open', type: 'boolean', default: true })
  isOpen: boolean;

  /** shown on the public forms list */
  @Column({ name: 'is_listed', type: 'boolean', default: true })
  isListed: boolean;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  fields: FieldDef[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  statuses: FormStatus[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  categories: FormCategory[];

  /** staff e-mail addresses told about every new submission (comma separated) */
  @Column({ name: 'notify_emails', type: 'text', nullable: true })
  notifyEmails: string | null;

  /** send the applicant a receipt (needs a field with role "email") */
  @Column({ name: 'send_receipt', type: 'boolean', default: true })
  sendReceipt: boolean;

  /** the applicant must accept the privacy policy before sending */
  @Column({ name: 'require_consent', type: 'boolean', default: true })
  requireConsent: boolean;

  /** submissions older than this many days are deleted automatically (null = kept until a person deletes them) */
  @Column({ name: 'retention_days', type: 'int', nullable: true })
  retentionDays: number | null;

  /** outgoing links to the chamber's own systems / databases (signed webhooks) */
  @Column({ type: 'jsonb', default: () => `'[]'` })
  integrations: FormIntegration[];

  /** bumped on every change of the fields */
  @Column({ type: 'int', default: 1 })
  version: number;

  @OneToMany(() => FormSubmission, (s) => s.form)
  submissions?: FormSubmission[];
}

@Entity('form_submissions')
@Index('idx_form_submissions_form_status', ['formId', 'status'])
@Index('idx_form_submissions_created', ['createdAt'])
export class FormSubmission extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'form_id', type: 'bigint' })
  formId: number;

  @ManyToOne(() => FormDefinition, (f) => f.submissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  form?: FormDefinition;

  /** "FRM-2026-00042" is derived from the id; nothing to store */
  @Column({ name: 'form_version', type: 'int', default: 1 })
  formVersion: number;

  /** the fields as they were when the person answered: later edits / deletions of the form never lose the labels of old answers */
  @Column({ name: 'fields_snapshot', type: 'jsonb', default: () => `'[]'` })
  fieldsSnapshot: FieldDef[];

  /** { fieldKey: value }; values of "sensitive" fields are encrypted when FORMS_ENCRYPTION_KEY is set */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  answers: Record<string, any>;

  /** copied from the fields with role name / email / phone, for the list, the search and "contact the applicant" */
  @Column({ name: 'applicant_name', type: 'varchar', length: 200, nullable: true })
  applicantName: string | null;

  @Column({ name: 'applicant_email', type: 'varchar', length: 190, nullable: true })
  applicantEmail: string | null;

  @Column({ name: 'applicant_phone', type: 'varchar', length: 60, nullable: true })
  applicantPhone: string | null;

  @Column({ length: 40, default: 'new' })
  status: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  category: string | null;

  @Column({ name: 'staff_notes', type: 'text', nullable: true })
  staffNotes: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'consent_at', type: 'timestamptz', nullable: true })
  consentAt: Date | null;

  /** set when the personal data was erased on request; the row stays only for statistics */
  @Column({ name: 'anonymized_at', type: 'timestamptz', nullable: true })
  anonymizedAt: Date | null;

  @OneToMany(() => FormSubmissionFile, (f) => f.submission)
  files?: FormSubmissionFile[];
}

@Entity('form_submission_files')
export class FormSubmissionFile {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index('idx_form_submission_files_sub')
  @Column({ name: 'submission_id', type: 'bigint' })
  submissionId: number;

  @ManyToOne(() => FormSubmission, (s) => s.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission?: FormSubmission;

  @Column({ name: 'field_key', length: 60 })
  fieldKey: string;

  @Column({ name: 'original_name', length: 255 })
  originalName: string;

  /** under private/forms/: served only to staff holding forms.submissions.read */
  @Column({ length: 500 })
  path: string;

  @Column({ type: 'int', default: 0 })
  size: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  protected setCreated() {
    this.createdAt = this.createdAt ?? new Date();
  }
}

/** Every message staff sent to an applicant from the dashboard (kept as the contact history of the request). */
@Entity('form_submission_messages')
export class FormSubmissionMessage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index('idx_form_submission_messages_sub')
  @Column({ name: 'submission_id', type: 'bigint' })
  submissionId: number;

  @ManyToOne(() => FormSubmission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission?: FormSubmission;

  @Column({ name: 'sent_by', type: 'bigint', nullable: true })
  sentBy: number | null;

  @Column({ name: 'sent_by_name', type: 'varchar', length: 150, nullable: true })
  sentByName: string | null;

  @Column({ length: 255 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'boolean', default: false })
  delivered: boolean;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  protected setCreated() {
    this.createdAt = this.createdAt ?? new Date();
  }
}
