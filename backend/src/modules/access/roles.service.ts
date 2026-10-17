import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PERM, TECHNICAL_ADMIN_ROLE } from '../../common/constants';
import { AuthUser } from '../../common/types';
import { Permission } from './permission.entity';
import { Role } from './role.entity';
import { RolePermission } from './role-permission.entity';
import { User } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './access.dto';
import { PermissionsService } from './permissions.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Permission) private readonly perms: Repository<Permission>,
    @InjectRepository(RolePermission) private readonly rp: Repository<RolePermission>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async list() {
    const rows = await this.ds.query(
      `SELECT r.id, r.code, r.name_ar AS nameAr, r.name_en AS nameEn, r.numeric_value AS numericValue,
              r.string_value AS stringValue, r.type,
              (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS usersCount,
              (SELECT COUNT(*) FROM role_permissions x WHERE x.role_id = r.id) AS permissionsCount
         FROM roles r ORDER BY r.id`,
    );
    return rows.map((r: any) => ({ ...r, id: Number(r.id), usersCount: Number(r.usersCount), permissionsCount: Number(r.permissionsCount) }));
  }

  async getOrFail(id: number) {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new NotFoundException('الدور غير موجود');
    return role;
  }

  async create(dto: CreateRoleDto, actor: AuthUser) {
    if (await this.roles.findOne({ where: [{ code: dto.code }, { nameAr: dto.nameAr }, { nameEn: dto.nameEn }] })) {
      throw new ConflictException('رمز الدور أو اسمه مستخدم مسبقاً');
    }
    const role = await this.roles.save(this.roles.create({ ...dto }));
    await this.audit.log({ category: 'permissions', action: 'role.create', description: `إنشاء الدور ${role.code}`, actorId: actor.id, entityType: 'roles', entityId: role.id });
    return role;
  }

  async update(id: number, dto: UpdateRoleDto, actor: AuthUser) {
    const role = await this.getOrFail(id);
    for (const [k, col] of [['nameAr', 'nameAr'], ['nameEn', 'nameEn']] as const) {
      if (dto[k] && dto[k] !== role[col] && (await this.roles.findOne({ where: { [col]: dto[k] } }))) {
        throw new ConflictException('اسم الدور مستخدم مسبقاً');
      }
    }
    Object.assign(role, dto);
    await this.roles.save(role);
    await this.audit.log({ category: 'permissions', action: 'role.update', description: `تعديل الدور ${role.code}`, actorId: actor.id, entityType: 'roles', entityId: id, details: dto as any });
    return role;
  }

  async remove(id: number, actor: AuthUser) {
    const role = await this.getOrFail(id);
    if (role.code === TECHNICAL_ADMIN_ROLE) throw new ConflictException('لا يمكن حذف دور المدير التقني');
    if (role.code === this.config.get('DEFAULT_ROLE_CODE', 'registered')) {
      throw new ConflictException('لا يمكن حذف الدور الافتراضي للتسجيل');
    }
    const used = await this.users.count({ where: { roleId: id } });
    if (used > 0) throw new ConflictException('لا يمكن حذف دور مرتبط بمستخدمين'); // SRS 26
    // never delete the only role that can still assign permissions
    const codes = await this.permissions.getRoleCodes(id);
    if (codes.has(PERM.PERMISSIONS_ASSIGN) && (await this.countAssigners(id)) === 0) {
      throw new ConflictException('لا يمكن حذف الدور الوحيد القادر على تعيين الصلاحيات');
    }
    await this.roles.delete(id);
    this.permissions.invalidate(id);
    await this.audit.log({ category: 'permissions', action: 'role.delete', description: `حذف الدور ${role.code}`, actorId: actor.id, entityType: 'roles', entityId: id });
    return { deleted: true };
  }

  listPermissions() {
    return this.perms.find({ order: { module: 'ASC', code: 'ASC' } });
  }

  async getRolePermissions(roleId: number) {
    await this.getOrFail(roleId);
    return { roleId, permissionCodes: [...(await this.permissions.getRoleCodes(roleId))].sort() };
  }

  /** Active users that can assign permissions, excluding one role. */
  async countAssigners(excludeRoleId?: number): Promise<number> {
    const rows = await this.ds.query(
      `SELECT COUNT(*) AS c FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE u.is_active = 1 ${excludeRoleId ? 'AND u.role_id <> ?' : ''}
          AND (r.code = ? OR EXISTS (
                SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                 WHERE rp.role_id = u.role_id AND p.code = ?))`,
      excludeRoleId ? [excludeRoleId, TECHNICAL_ADMIN_ROLE, PERM.PERMISSIONS_ASSIGN] : [TECHNICAL_ADMIN_ROLE, PERM.PERMISSIONS_ASSIGN],
    );
    return Number(rows[0].c);
  }

  /** PUT: replace the role's permission set, always persisted in role_permissions (SRS FR-PERM-002). */
  async setRolePermissions(roleId: number, dto: SetRolePermissionsDto, actor: AuthUser) {
    const role = await this.getOrFail(roleId);
    if (role.code === TECHNICAL_ADMIN_ROLE) throw new ConflictException('دور المدير التقني يملك كل الصلاحيات دائماً ولا يمكن تعديلها');
    const wanted = new Set(dto.permissionCodes);
    const all = await this.perms.find();
    const known = new Map(all.map((p) => [p.code, p]));
    const unknown = [...wanted].filter((c) => !known.has(c));
    if (unknown.length) throw new BadRequestException(`صلاحيات غير معروفة: ${unknown.join(', ')}`);

    const current = await this.permissions.getRoleCodes(roleId);
    const currentFresh = new Set([...current]);

    // Anti-escalation: can't touch a role stronger than yourself, nor grant what you don't hold.
    if (!PermissionsService.isSubset(currentFresh, actor.permissions)) {
      await this.deny(actor, 'permission_escalation_attempt', 'محاولة تعديل دور أعلى من صلاحيات المنفّذ', { roleId });
    }
    const added = [...wanted].filter((c) => !currentFresh.has(c));
    const overreach = added.filter((c) => !actor.permissions.has(c));
    if (overreach.length) {
      await this.deny(actor, 'permission_escalation_attempt', 'محاولة منح صلاحيات لا يملكها المنفّذ', { roleId, overreach });
    }
    const removed = [...currentFresh].filter((c) => !wanted.has(c));

    if (removed.includes(PERM.PERMISSIONS_ASSIGN) && (await this.countAssigners(roleId)) === 0) {
      throw new ConflictException('لا يمكن إزالة صلاحية تعيين الصلاحيات من آخر دور يملكها');
    }

    await this.ds.transaction(async (m) => {
      const rp = m.getRepository(RolePermission);
      if (removed.length) {
        await rp.createQueryBuilder().delete().where('role_id = :r AND permission_id IN (:...ids)', { r: roleId, ids: removed.map((c) => known.get(c).id) }).execute();
      }
      for (const c of added) await rp.save(rp.create({ roleId, permissionId: known.get(c).id }));
    });
    this.permissions.invalidate(roleId);

    await this.audit.log({
      category: 'permissions',
      action: 'role.permissions.update',
      description: `تحديث صلاحيات الدور ${role.code}`,
      actorId: actor.id,
      entityType: 'roles',
      entityId: roleId,
      details: { added, removed },
    });
    return this.getRolePermissions(roleId);
  }

  private async deny(actor: AuthUser, action: string, description: string, details: Record<string, any>): Promise<never> {
    await this.audit.log({ category: 'security', action, description, actorId: actor.id, details });
    throw new ForbiddenException('لا يمكنك منح أو تعديل صلاحيات تتجاوز صلاحياتك');
  }
}
