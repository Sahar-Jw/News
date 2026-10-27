import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/** One-time reset link. Only the SHA-256 of the token is stored, so a leaked table cannot be used to reset anything. */
@Entity('password_resets')
@Index('uq_password_resets_token', ['tokenHash'], { unique: true })
@Index('idx_password_resets_user', ['userId'])
export class PasswordReset extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ name: 'token_hash', length: 64 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;
}
