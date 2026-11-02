import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/** Which part of the site a question belongs to (the public page filters by it). */
export const FAQ_SCOPES = ['general', 'one_stop', 'membership', 'training', 'expo'] as const;
export type FaqScope = (typeof FAQ_SCOPES)[number];

@Entity('faqs')
@Index('idx_faqs_scope_order', ['scope', 'sortOrder'])
export class Faq extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 30, default: 'general' })
  scope: FaqScope;

  @Column({ name: 'question_ar', length: 500 })
  questionAr: string;

  /** optional: the Arabic text is shown when empty */
  @Column({ name: 'question_en', type: 'varchar', length: 500, nullable: true })
  questionEn: string | null;

  @Column({ name: 'answer_ar', type: 'text' })
  answerAr: string;

  @Column({ name: 'answer_en', type: 'text', nullable: true })
  answerEn: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
