import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';

@Entity('galleries')
export class Gallery extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'title_ar', length: 255 })
  titleAr: string;

  @Column({ name: 'title_en', length: 255 })
  titleEn: string;

  /** relative storage paths (at least one) */
  @Column({ type: 'json', nullable: true })
  images: string[] | null;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;
}
