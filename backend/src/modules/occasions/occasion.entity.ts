import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';

@Entity('occasions')
@Index('idx_occasions_date', ['eventDate'])
export class Occasion extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'title_ar', length: 255 })
  titleAr: string;

  @Column({ name: 'title_en', length: 255 })
  titleEn: string;

  /** calendar day, "YYYY-MM-DD" */
  @Column({ name: 'event_date', type: 'date' })
  eventDate: string;

  /** relative storage paths */
  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;
}
