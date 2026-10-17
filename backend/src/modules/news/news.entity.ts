import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Language, NewsStatus, Visibility } from '../../common/constants';
import { TimestampedEntity } from '../../common/entities/base.entity';
import { User } from '../users/user.entity';

/** The single unified content table (SRS 13 / 17.5). */
@Entity('news')
@Index('idx_news_status_publish', ['status', 'publishAt'])
@Index('idx_news_listing', ['language', 'status', 'visibility', 'mainCategory'])
@Index('idx_news_subcategory', ['language', 'status', 'visibility', 'subcategory'])
@Index('idx_news_featured', ['isFeatured', 'publishAt'])
export class News extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject: string | null;

  @Column({ name: 'main_category', length: 100 })
  mainCategory: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subcategory: string | null;

  @Column({ type: 'json', nullable: true })
  topics: string[] | null;

  @Column({ type: 'mediumtext', nullable: true })
  body: string | null;

  @Column({ type: 'json', nullable: true })
  images: string[] | null;

  @Column({ type: 'tinyint', unsigned: true, nullable: true })
  rating: number | null;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ name: 'publish_at', type: 'datetime', nullable: true })
  publishAt: Date | null;

  @Column({ type: 'enum', enum: NewsStatus, default: NewsStatus.PUBLISHED })
  status: NewsStatus;

  @Column({ type: 'enum', enum: Language, default: Language.AR })
  language: Language;

  @Column({ type: 'enum', enum: Visibility, default: Visibility.PUBLIC })
  visibility: Visibility;

  @Column({ name: 'view_count', type: 'int', unsigned: true, default: 0 })
  viewCount: number;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;
}
