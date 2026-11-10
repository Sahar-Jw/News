import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

export const MEMBERSHIP_STATUSES = ['new', 'in_review', 'accepted', 'rejected'] as const;
export const BUSINESS_TYPES = ['individual', 'company', 'other'] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** Single row (id = 1): the texts of the public "Membership" page and the address that gets every new application. */
@Entity('membership_settings')
export class MembershipSettings extends TimestampedEntity {
  @PrimaryColumn({ type: 'int' })
  id: number;

  /** sanitized HTML: membership conditions */


  /** sanitized HTML: required documents */


  /** sanitized HTML: the approved fee table */


  /** one step per line, shown as the numbered path (apply > upload > pay > review > receive) */


  /** receives an e-mail for every new application */
  @Column({ name: 'notify_email', type: 'varchar', length: 190, nullable: true })
  notifyEmail: string | null;

  /** false = the form is closed (the page stays readable) */
  @Column({ name: 'is_open', type: 'boolean', default: true })
  isOpen: boolean;
}

/** One request to join the chamber. The document files live under private/membership/ and need the membership.read permission. */
@Entity('membership_applications')
@Index('idx_membership_applications_status', ['status', 'createdAt'])
export class MembershipApplication extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'company_name', length: 255 })
  companyName: string;

  /** the business activity */
  @Column({ length: 255 })
  activity: string;

  /** full (three-part) name of the establishment's owner or of the person authorised to sign */
  @Column({ name: 'manager_name', length: 150 })
  managerName: string;

  /** individual establishment / company / other (described in businessTypeOther) */
  @Column({ name: 'business_type', type: 'varchar', length: 20, nullable: true })
  businessType: BusinessType | null;

  @Column({ name: 'business_type_other', type: 'varchar', length: 120, nullable: true })
  businessTypeOther: string | null;

  @Column({ name: 'commercial_reg_no', type: 'varchar', length: 60, nullable: true })
  commercialRegNo: string | null;

  /** date the establishment was registered in the commercial register (YYYY-MM-DD) */
  @Column({ name: 'registration_date', type: 'date', nullable: true })
  registrationDate: string | null;

  /** the person authorised to be contacted, when it is not the owner */
  @Column({ name: 'contact_person', type: 'varchar', length: 150, nullable: true })
  contactPerson: string | null;

  @Column({ length: 50 })
  phone: string;

  /** stored lower-case */
  @Column({ length: 190 })
  email: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: MembershipStatus;

  /** internal notes of the staff member: never shown to the applicant */
  @Column({ name: 'staff_notes', type: 'text', nullable: true })
  staffNotes: string | null;
}

@Entity('membership_files')
@Index('idx_membership_files_application', ['applicationId'])
export class MembershipFile extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'application_id', type: 'bigint' })
  applicationId: number;

  @Column({ name: 'original_name', length: 255 })
  originalName: string;

  /** relative path under private/membership/ */
  @Column({ length: 500 })
  path: string;

  @Column({ type: 'int', default: 0 })
  size: number;
}
