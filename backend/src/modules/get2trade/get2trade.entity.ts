import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

export const SPACE_KINDS = ['office', 'coworking', 'meeting_room', 'other'] as const;
export type SpaceKind = (typeof SPACE_KINDS)[number];
export const BOOKING_KINDS = ['booking', 'inquiry'] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];
export const BOOKING_STATUSES = ['new', 'in_review', 'accepted', 'rejected'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Single row (id = 1): the texts of the public Get2Trade page, who gets the booking e-mails and whether booking is open. */
@Entity('g2t_settings')
export class Get2TradeSettings extends TimestampedEntity {
  @PrimaryColumn({ type: 'int' })
  id: number;

  /** sanitized HTML: about the company */
  @Column({ name: 'about_ar', type: 'text', nullable: true })
  aboutAr: string | null;
  @Column({ name: 'about_en', type: 'text', nullable: true })
  aboutEn: string | null;

  /** sanitized HTML: the services (equipped offices, workspaces, meeting rooms ...) */
  @Column({ name: 'services_ar', type: 'text', nullable: true })
  servicesAr: string | null;
  @Column({ name: 'services_en', type: 'text', nullable: true })
  servicesEn: string | null;

  /** the news tag whose articles appear in "company news" */
  @Column({ name: 'news_topic_ar', type: 'varchar', length: 100, nullable: true })
  newsTopicAr: string | null;
  @Column({ name: 'news_topic_en', type: 'varchar', length: 100, nullable: true })
  newsTopicEn: string | null;

  /** receives an e-mail for every new booking / inquiry */
  @Column({ name: 'notify_email', type: 'varchar', length: 190, nullable: true })
  notifyEmail: string | null;

  /** false = booking is closed (inquiries are still accepted, the page stays readable) */
  @Column({ name: 'is_open', type: 'boolean', default: true })
  isOpen: boolean;
}

/** A package (flexible-office plan). The price is free text and optional until the prices are approved. */
@Entity('g2t_packages')
export class G2tPackage extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'name_ar', length: 150 })
  nameAr: string;
  @Column({ name: 'name_en', type: 'varchar', length: 150, nullable: true })
  nameEn: string | null;

  /** one feature per line */
  @Column({ name: 'features_ar', type: 'text', nullable: true })
  featuresAr: string | null;
  @Column({ name: 'features_en', type: 'text', nullable: true })
  featuresEn: string | null;

  @Column({ name: 'price_ar', type: 'varchar', length: 150, nullable: true })
  priceAr: string | null;
  @Column({ name: 'price_en', type: 'varchar', length: 150, nullable: true })
  priceEn: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

/** A space people can book: an equipped office, a coworking seat, a meeting room. */
@Entity('g2t_spaces')
export class G2tSpace extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20, default: 'office' })
  kind: SpaceKind;

  @Column({ name: 'name_ar', length: 150 })
  nameAr: string;
  @Column({ name: 'name_en', type: 'varchar', length: 150, nullable: true })
  nameEn: string | null;

  @Column({ name: 'description_ar', type: 'text', nullable: true })
  descriptionAr: string | null;
  @Column({ name: 'description_en', type: 'text', nullable: true })
  descriptionEn: string | null;

  /** people it holds */
  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  /** area in square metres */
  @Column({ name: 'area_sqm', type: 'int', nullable: true })
  areaSqm: number | null;

  @Column({ name: 'price_ar', type: 'varchar', length: 150, nullable: true })
  priceAr: string | null;
  @Column({ name: 'price_en', type: 'varchar', length: 150, nullable: true })
  priceEn: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image: string | null;

  /** false = shown as "not available now" and cannot be booked */
  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

/** One booking request or inquiry. Deleting a space or package keeps the request (the link is just cleared). */
@Entity('g2t_bookings')
@Index('idx_g2t_bookings_status', ['status', 'createdAt'])
export class G2tBooking extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 10, default: 'booking' })
  kind: BookingKind;

  @Column({ name: 'space_id', type: 'bigint', nullable: true })
  spaceId: number | null;
  @ManyToOne(() => G2tSpace, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'space_id' })
  space?: G2tSpace | null;

  @Column({ name: 'package_id', type: 'bigint', nullable: true })
  packageId: number | null;
  @ManyToOne(() => G2tPackage, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'package_id' })
  package?: G2tPackage | null;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  company: string | null;

  @Column({ length: 50 })
  phone: string;

  /** stored lower-case */
  @Column({ length: 190 })
  email: string;

  /** wished start of the rental */
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'int', nullable: true })
  people: number | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: BookingStatus;

  /** internal notes of the staff member: never shown to the applicant */
  @Column({ name: 'staff_notes', type: 'text', nullable: true })
  staffNotes: string | null;
}
