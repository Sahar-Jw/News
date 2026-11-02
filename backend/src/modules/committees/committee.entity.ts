import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/** sector = a sectoral committee; women = the businesswomen committee (same page template + an "initiatives" tab). */
export const COMMITTEE_KINDS = ['sector', 'women'] as const;
export type CommitteeKind = (typeof COMMITTEE_KINDS)[number];

/** Member roles in display order. */
export const MEMBER_ROLES = ['chair', 'vice', 'member'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** What the committee did: meetings, visits, recommendations/outputs and (women kind) initiatives. */
export const ACTIVITY_KINDS = ['meeting', 'visit', 'recommendation', 'initiative'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

@Entity('committees')
@Index('idx_committees_kind', ['kind', 'isActive', 'sortOrder'])
export class Committee extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20, default: 'sector' })
  kind: CommitteeKind;

  @Column({ name: 'name_ar', length: 255 })
  nameAr: string;

  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn: string | null;

  /** short definition shown in the page header and on the cards */
  @Column({ name: 'summary_ar', type: 'text', nullable: true })
  summaryAr: string | null;

  @Column({ name: 'summary_en', type: 'text', nullable: true })
  summaryEn: string | null;

  /** sanitized HTML: the committee's terms of reference */
  @Column({ name: 'duties_ar', type: 'text', nullable: true })
  dutiesAr: string | null;

  @Column({ name: 'duties_en', type: 'text', nullable: true })
  dutiesEn: string | null;

  /** committee chair, shown in the header (members list can repeat him/her) */
  @Column({ name: 'chair_name_ar', type: 'varchar', length: 255, nullable: true })
  chairNameAr: string | null;

  @Column({ name: 'chair_name_en', type: 'varchar', length: 255, nullable: true })
  chairNameEn: string | null;

  /** business activities the committee covers, comma separated; searched by the public "find my committee" box */
  @Column({ name: 'activity_tags_ar', type: 'text', nullable: true })
  activityTagsAr: string | null;

  @Column({ name: 'activity_tags_en', type: 'text', nullable: true })
  activityTagsEn: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}

@Entity('committee_members')
@Index('idx_committee_members_committee', ['committeeId', 'sortOrder'])
export class CommitteeMember extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'committee_id', type: 'bigint' })
  committeeId: number;

  @Column({ type: 'varchar', length: 20, default: 'member' })
  role: MemberRole;

  @Column({ name: 'name_ar', length: 255 })
  nameAr: string;

  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn: string | null;

  /** company / job title line under the name */
  @Column({ name: 'title_ar', type: 'varchar', length: 255, nullable: true })
  titleAr: string | null;

  @Column({ name: 'title_en', type: 'varchar', length: 255, nullable: true })
  titleEn: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  photo: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

@Entity('committee_activities')
@Index('idx_committee_activities_committee', ['committeeId', 'kind', 'eventDate'])
export class CommitteeActivity extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'committee_id', type: 'bigint' })
  committeeId: number;

  @Column({ type: 'varchar', length: 20 })
  kind: ActivityKind;

  @Column({ name: 'title_ar', length: 255 })
  titleAr: string;

  @Column({ name: 'title_en', type: 'varchar', length: 255, nullable: true })
  titleEn: string | null;

  /** sanitized HTML: minutes, recommendations, description */
  @Column({ name: 'body_ar', type: 'text', nullable: true })
  bodyAr: string | null;

  @Column({ name: 'body_en', type: 'text', nullable: true })
  bodyEn: string | null;

  /** meetings/visits in the future are listed as "upcoming"; computed at query time, no job needed */
  @Column({ name: 'event_date', type: 'date', nullable: true })
  eventDate: string | null;
}
