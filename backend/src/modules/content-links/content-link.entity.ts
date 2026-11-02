import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/** Entity kinds a news item can be attached to ("smart archiving", document 7.2). Add new kinds here. */
export const LINK_ENTITY_TYPES = ['committee'] as const;
export type LinkEntityType = (typeof LINK_ENTITY_TYPES)[number];

/** One news item shown inside another entity's page (committee, later: event, course, expo, board member). */
@Entity('content_links')
@Index('uq_content_links', ['newsId', 'entityType', 'entityId'], { unique: true })
@Index('idx_content_links_entity', ['entityType', 'entityId'])
export class ContentLink extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'news_id', type: 'bigint' })
  newsId: number;

  @Column({ name: 'entity_type', type: 'varchar', length: 30 })
  entityType: LinkEntityType;

  @Column({ name: 'entity_id', type: 'bigint' })
  entityId: number;
}
