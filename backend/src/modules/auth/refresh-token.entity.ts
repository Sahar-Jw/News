import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';

/**
 * Long-lived sign-in (refresh token). Only the SHA-256 of the token is stored. Every use rotates it: the old row is revoked and a new one
 * of the same family is created, so a stolen token that is used twice is noticed and the whole family is revoked.
 */
@Entity('refresh_tokens')
@Index('uq_refresh_tokens_hash', ['tokenHash'], { unique: true })
@Index('idx_refresh_tokens_user', ['userId'])
@Index('idx_refresh_tokens_family', ['familyId'])
export class RefreshToken extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'user_id', type: 'bigint' })
  userId: number;

  @Column({ name: 'token_hash', length: 64 })
  tokenHash: string;

  /** one sign-in on one device = one family; every rotation keeps it */
  @Column({ name: 'family_id', length: 36 })
  familyId: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
