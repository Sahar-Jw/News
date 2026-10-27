import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AD_PLACEMENTS } from '../../common/constants';
import { TimestampedEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';

@Entity('ads')
@Index('idx_ads_show', ['placement', 'isActive', 'startDate', 'endDate'])
export class Ad extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'owner_company', length: 255 })
  ownerCompany: string;

  @Column({ name: 'link_url', length: 500 })
  linkUrl: string;

  /** golden = top of the page, bronze = middle of the page, silver = bottom */
  @Column({ type: 'enum', enum: AD_PLACEMENTS })
  placement: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  /** one picture = a still banner, several = a carousel that moves on its own */
  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;
}
