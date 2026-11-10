import { News } from '../news/news.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

export const SPACE_KINDS = ['office', 'coworking', 'meeting_room', 'other'] as const;
export type SpaceKind = (typeof SPACE_KINDS)[number];
export const DURATION_UNITS = ['day', 'week', 'month', 'year'] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];
export const BOOKING_KINDS = ['booking', 'inquiry'] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];
export const BOOKING_STATUSES = ['new', 'in_review', 'accepted', 'rejected'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Single row (id = 1): who gets the booking e-mails and whether booking is open. The page texts are a news row (main category G2T_INFO). */
@Entity('g2t_settings')
export class Get2TradeSettings extends TimestampedEntity {
  @PrimaryColumn({ type: 'int' })
  id: number;

  /** where new booking requests are e-mailed */
  @Column({ name: 'notify_email', type: 'varchar', length: 190, nullable: true })
  notifyEmail: string | null;

  /** false = the booking form only accepts inquiries */
  @Column({ name: 'is_open', type: 'boolean', default: true })
  isOpen: boolean;
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
  /** the space / package are news rows (G2T_SPACE / G2T_PACKAGE) */
  @ManyToOne(() => News, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'space_id' })
  space?: News | null;

  @Column({ name: 'package_id', type: 'bigint', nullable: true })
  packageId: number | null;
  @ManyToOne(() => News, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'package_id' })
  package?: News | null;

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

  /** the kind of office / space the applicant asked for (office, coworking, meeting room...) */
  @Column({ name: 'space_kind', type: 'varchar', length: 20, nullable: true })
  spaceKind: SpaceKind | null;

  /** wished rental duration: a number + a unit (day / week / month / year) */
  @Column({ name: 'duration_value', type: 'int', nullable: true })
  durationValue: number | null;

  @Column({ name: 'duration_unit', type: 'varchar', length: 10, nullable: true })
  durationUnit: DurationUnit | null;

  /** additional services the applicant asked for, free text */
  @Column({ name: 'extra_services', type: 'text', nullable: true })
  extraServices: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: BookingStatus;

  /** internal notes of the staff member: never shown to the applicant */
  @Column({ name: 'staff_notes', type: 'text', nullable: true })
  staffNotes: string | null;
}
