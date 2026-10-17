import { BeforeInsert, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Permission } from './permission.entity';
import { Role } from './role.entity';

@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn({ name: 'role_id', type: 'bigint', unsigned: true })
  roleId: number;

  @PrimaryColumn({ name: 'permission_id', type: 'bigint', unsigned: true })
  permissionId: number;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @BeforeInsert()
  protected setCreated() {
    this.createdAt = this.createdAt ?? new Date();
  }
}
