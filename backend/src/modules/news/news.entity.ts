import { BeforeInsert, BeforeUpdate, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Language, NewsStatus, Visibility } from '../../common/constants';
import { TimestampedEntity } from '../../common/entities/base.entity';
import { excerpt as makeExcerpt, mentionsChamberHead } from '../../common/utils/text';
import { User } from '../users/user.entity';

/** The single unified content table (SRS 13 / 17.5). */
@Entity('news')
@Index('idx_news_status_publish', ['status', 'publishAt'])
@Index('idx_news_listing', ['language', 'status', 'visibility', 'mainCategory'])
@Index('idx_news_subcategory', ['language', 'status', 'visibility', 'subcategory'])
@Index('idx_news_category_date', ['language', 'mainCategory', 'publishAt'])
@Index('idx_news_views', ['language', 'viewCount'])
@Index('idx_news_featured', ['isFeatured', 'publishAt'])
@Index('idx_news_public_order', ['language', 'publishAt', 'id'])
@Index('idx_news_chamber_head', ['publishAt'], { where: '"mentions_chamber_head" = true' })
export class News extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject: string | null;

  @Column({ name: 'main_category', length: 100 })
  mainCategory: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  subcategory: string | null;

  @Column({ type: 'jsonb', nullable: true })
  topics: string[] | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Plain-text summary of `body`, kept in sync on every save so lists never have to load the (large) body. */
  @Column({ type: 'varchar', length: 400, nullable: true })
  excerpt: string | null;

  @Column({ type: 'jsonb', nullable: true })
  images: string[] | null;

  /** One optional PDF per record (relative storage path), shown on its own on the detail page. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  pdf: string | null;

  /** All PDFs of the record (relative storage paths, in display order); `pdf` always mirrors the first one. Empty = fall back to `pdf`. */
  @Column({ type: 'jsonb', nullable: true })
  pdfs: string[] | null;

  /** Optional YouTube video (canonical watch URL), embedded on the detail page of regular news. */
  @Column({ name: 'youtube_url', type: 'varchar', length: 255, nullable: true })
  youtubeUrl: string | null;

  @Column({ type: 'smallint', nullable: true })
  rating: number | null;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured: boolean;

  /** Maintained automatically on every save: true when title/subject/body mention "رئيس الغرفة". Such news also shows in the home featured carousel. */
  @Column({ name: 'mentions_chamber_head', type: 'boolean', default: false })
  mentionsChamberHead: boolean;

  @Column({ name: 'publish_at', type: 'timestamptz', nullable: true })
  publishAt: Date | null;

  @Column({ type: 'enum', enum: NewsStatus, default: NewsStatus.PUBLISHED })
  status: NewsStatus;

  @Column({ type: 'enum', enum: Language, default: Language.AR })
  language: Language;

  @Column({ type: 'enum', enum: Visibility, default: Visibility.PUBLIC })
  visibility: Visibility;

  /** content types only (FAQ, documents, board ...): their own fields, see common/content-categories.ts and modules/content */
  @Column({ type: 'jsonb', nullable: true })
  extra: Record<string, any> | null;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdById: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @BeforeInsert()
  @BeforeUpdate()
  protected syncExcerpt() {
    if (this.body !== undefined) {
      this.excerpt = makeExcerpt(this.body, 300) || null;
      this.mentionsChamberHead = mentionsChamberHead(this.title, this.subject, this.body);
    }
  }
}
