import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';

export const GALLERY_KINDS = ['photos', 'video'] as const;
export type GalleryKind = (typeof GALLERY_KINDS)[number];
/** Visual archive classification (document 6.20); empty = unclassified */
export const GALLERY_CATEGORIES = ['meeting', 'event', 'exhibition', 'conference', 'visit', 'committee', 'course'] as const;
export type GalleryCategory = (typeof GALLERY_CATEGORIES)[number];

@Entity('galleries')
export class Gallery extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'title_ar', length: 255 })
  titleAr: string;

  @Column({ name: 'title_en', length: 255 })
  titleEn: string;

  /** photos = an album of pictures; video = a YouTube video (pictures are then optional: the first one is its cover) */
  @Column({ type: 'varchar', length: 10, default: 'photos' })
  kind: GalleryKind;

  /** canonical https://www.youtube.com/watch?v=... (only when kind = video) */
  @Column({ name: 'youtube_url', type: 'varchar', length: 255, nullable: true })
  youtubeUrl: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  category: GalleryCategory | null;

  /** relative storage paths (at least one for photo albums) */
  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  /** optional: the album belongs to a committee and appears in its "photos" tab (FK committees.id, ON DELETE SET NULL) */
  @Column({ name: 'committee_id', type: 'bigint', nullable: true })
  committeeId: number | null;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;
}
