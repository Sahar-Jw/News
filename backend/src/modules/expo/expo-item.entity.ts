import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

export const EXPO_KINDS = ['exhibitor', 'sponsor', 'session'] as const;
export type ExpoKind = (typeof EXPO_KINDS)[number];
/** sponsor tier or session type, stored in `category` */
export const SPONSOR_TIERS = ['strategic', 'gold', 'silver', 'partner'] as const;
export const SESSION_TYPES = ['seminar', 'workshop', 'b2b', 'keynote', 'other'] as const;

/**
 * One row of the DCC EXPO public content: an exhibitor, a sponsor or a programme session (told apart by `kind`).
 * - exhibitor: name, sector (`sectorAr/En`), booth (`place`), website, logo
 * - sponsor:   name, tier (`category`), website, logo
 * - session:   title (`nameAr/En`), type (`category`), start/end time, hall (`place`), speaker (`personAr/En`)
 */
@Entity('expo_items')
@Index('idx_expo_items_kind', ['kind', 'sortOrder'])
export class ExpoItem extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20 })
  kind: ExpoKind;

  @Column({ name: 'name_ar', length: 255 })
  nameAr: string;
  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn: string | null;

  @Column({ name: 'description_ar', type: 'text', nullable: true })
  descriptionAr: string | null;
  @Column({ name: 'description_en', type: 'text', nullable: true })
  descriptionEn: string | null;

  @Column({ name: 'sector_ar', type: 'varchar', length: 150, nullable: true })
  sectorAr: string | null;
  @Column({ name: 'sector_en', type: 'varchar', length: 150, nullable: true })
  sectorEn: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  category: string | null;

  @Column({ name: 'person_ar', type: 'varchar', length: 150, nullable: true })
  personAr: string | null;
  @Column({ name: 'person_en', type: 'varchar', length: 150, nullable: true })
  personEn: string | null;

  @Column({ name: 'place_ar', type: 'varchar', length: 150, nullable: true })
  placeAr: string | null;
  @Column({ name: 'place_en', type: 'varchar', length: 150, nullable: true })
  placeEn: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;
  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
