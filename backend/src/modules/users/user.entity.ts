import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TimestampedEntity } from '../../common/entities/base.entity';
import { City } from '../cities/city.entity';
import { Role } from '../access/role.entity';

@Entity('users')
export class User extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({ length: 190, unique: true })
  email: string;

  @Column({ name: 'password_hash', length: 255, select: false })
  passwordHash: string;

  /** Set when the password is reset by e-mail: sessions issued before this moment stop working. */
  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true, select: false })
  passwordChangedAt: Date | null;

  @Column({ name: 'role_id', type: 'bigint' })
  roleId: number;

  @ManyToOne(() => Role, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: ['male', 'female'], nullable: true })
  gender: 'male' | 'female' | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ name: 'city_id', type: 'bigint', nullable: true })
  cityId: number | null;

  @ManyToOne(() => City, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'city_id' })
  city: City | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nationality: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'avatar_path', type: 'varchar', length: 255, nullable: true })
  avatarPath: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'cv_path', type: 'varchar', length: 255, nullable: true })
  cvPath: string | null;

  @Column({ name: 'social_link', type: 'varchar', length: 500, nullable: true })
  socialLink: string | null;

  @Column({ name: 'is_expert', type: 'boolean', default: false })
  isExpert: boolean;

  @Column({ name: 'is_researcher', type: 'boolean', default: false })
  isResearcher: boolean;
}
