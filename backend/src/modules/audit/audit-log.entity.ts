import { BeforeInsert, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { AuditChange } from './audit-context';

@Entity('audit_logs')
@Index('idx_audit_created_category', ['createdAt', 'category'])
@Index('idx_audit_entity', ['entityType', 'entityId'])
@Index('idx_audit_actor_created', ['actorId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ length: 50 })
  category: string;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 500 })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, any> | null;

  @Column({ name: 'actor_id', type: 'bigint', nullable: true })
  actorId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor: User | null;

  /** Logical reference (no FK – points to many tables). */
  @Column({ name: 'entity_type', type: 'varchar', length: 50, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'bigint', nullable: true })
  entityId: number | null;

  /** What the action changed: full row on create, changed fields (old -> new) on update, full row on delete. */
  @Column({ type: 'jsonb', nullable: true })
  changes: AuditChange[] | null;

  /** Where the request came from. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  /** Route pattern (/admin/ads/:id), never the real URL: no ids, tokens or query strings. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  route: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  protected setCreated() {
    this.createdAt = this.createdAt ?? new Date();
  }
}
