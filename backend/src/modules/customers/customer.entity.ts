import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';

@Entity('customers')
export class Customer extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 30 })
  phone: string;

  @Column({ type: 'smallint', nullable: true })
  age: number | null;

  @Column({ type: 'enum', enum: ['male', 'female'], nullable: true })
  gender: string | null;

  /** free text typed when the customer is added */
  @Column({ type: 'text', nullable: true })
  procedures: string | null;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;
}
