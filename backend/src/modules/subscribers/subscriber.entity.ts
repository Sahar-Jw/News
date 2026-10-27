import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/** Newsletter subscriber. The token confirms the e-mail address and also unsubscribes. */
@Entity('subscribers')
@Index('uq_subscribers_email', ['email'], { unique: true })
@Index('uq_subscribers_token', ['rememberToken'], { unique: true })
export class Subscriber extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 190 })
  email: string;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'remember_token', length: 64 })
  rememberToken: string;
}
