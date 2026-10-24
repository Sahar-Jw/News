import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';
import { Customer } from '../customers/customer.entity';
import { User } from '../users/user.entity';

/** A "date" in the Tools menu: a customer, a day and hour, a status and the procedures. */
@Entity('appointments')
@Index('idx_appointments_when', ['appointmentDate', 'appointmentTime'])
@Index('idx_appointments_status', ['status'])
export class Appointment extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId: number;

  @ManyToOne(() => Customer, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  /** calendar day, "YYYY-MM-DD" */
  @Column({ name: 'appointment_date', type: 'date' })
  appointmentDate: string;

  /** "HH:MM:SS" */
  @Column({ name: 'appointment_time', type: 'time' })
  appointmentTime: string;

  /** a status code from Settings (appointments.statuses) */
  @Column({ length: 50 })
  status: string;

  @Column({ type: 'text', nullable: true })
  procedures: string | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;
}
