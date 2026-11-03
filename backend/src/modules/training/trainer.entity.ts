import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/** A trainer of the Administrative Training Center. Arabic is required; English is optional. */
@Entity('trainers')
export class Trainer extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'name_ar', length: 150 })
  nameAr: string;
  @Column({ name: 'name_en', type: 'varchar', length: 150, nullable: true })
  nameEn: string | null;

  /** short professional bio */
  @Column({ name: 'bio_ar', type: 'text', nullable: true })
  bioAr: string | null;
  @Column({ name: 'bio_en', type: 'text', nullable: true })
  bioEn: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
