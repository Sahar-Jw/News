import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Brackets, In, Repository } from 'typeorm';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { PERM } from '../../common/constants';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { City } from '../cities/city.entity';
import { Role } from '../access/role.entity';
import { User } from './user.entity';
import { PermissionsService } from '../access/permissions.service';
import { RolesService } from '../access/roles.service';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { ChangePasswordDto, UpdateProfileDto, UpdateUserDto, UserListQueryDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(City) private readonly cities: Repository<City>,
    private readonly permissions: PermissionsService,
    private readonly rolesService: RolesService,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
  ) {}

  present(u: User) {
    if (!u) return u;
    const { avatarPath, cvPath, ...rest } = u as any;
    return { ...rest, avatarUrl: this.storage.url(avatarPath), hasCv: !!cvPath };
  }

  private buildQuery(q: UserListQueryDto) {
    const qb = this.users.createQueryBuilder('u').leftJoinAndSelect('u.role', 'role').leftJoinAndSelect('u.city', 'city');
    if (q.roleId) qb.andWhere('u.roleId = :rid', { rid: q.roleId });
    if (q.isActive !== undefined) qb.andWhere('u.isActive = :act', { act: q.isActive });
    if (q.from) qb.andWhere('u.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('u.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('u.fullName LIKE :like', { like }).orWhere('u.email LIKE :like', { like }).orWhere('u.phone LIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { fullName: 'u.fullName', email: 'u.email', phone: 'u.phone', role: ['role.nameAr', 'role.nameEn', 'role.code'], createdAt: 'CAST(u.createdAt AS CHAR)' });
    qb.orderBy('u.id', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC');
    return qb;
  }

  async list(q: UserListQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.buildQuery(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  listAll(q: UserListQueryDto) {
    return this.buildQuery(q).take(10000).getMany();
  }

  async getOrFail(id: number, withRelations = true) {
    const u = await this.users.findOne({ where: { id }, relations: withRelations ? { role: true, city: true } : undefined });
    if (!u) throw new NotFoundException('المستخدم غير موجود');
    return u;
  }

  async get(id: number) {
    return this.present(await this.getOrFail(id));
  }

  // ---------- anti-escalation helpers (SRS 15.3-5) ----------
  private async assertRoleAssignable(roleId: number, actor: AuthUser) {
    const role = await this.roles.findOne({ where: { id: roleId } });
    if (!role) throw new BadRequestException('الدور غير موجود');
    const target = await this.permissions.getRoleCodes(roleId);
    if (!PermissionsService.isSubset(target, actor.permissions)) {
      await this.audit.log({ category: 'security', action: 'privilege_escalation_attempt', description: 'محاولة إسناد دور أعلى من صلاحيات المنفّذ', actorId: actor.id, details: { roleId } });
      throw new ForbiddenException('لا يمكنك إسناد دور يتجاوز صلاحياتك');
    }
  }

  /** Throws 403 (and records a security event) unless the actor holds `code`. */
  private async requirePermission(actor: AuthUser, code: string, targetId: number, auditText: string, message: string) {
    if (actor.permissions.has(code)) return;
    await this.audit.log({ category: 'security', action: 'permission_denied', description: auditText, actorId: actor.id, entityType: 'users', entityId: targetId, details: { required: [code] } });
    throw new ForbiddenException(message);
  }

  private async assertCanManage(target: User, actor: AuthUser) {
    if (target.id === actor.id) throw new ForbiddenException('لا يمكنك تعديل حسابك من جدول المستخدمين، استخدم الملف الشخصي');
    const codes = await this.permissions.getRoleCodes(target.roleId);
    if (!PermissionsService.isSubset(codes, actor.permissions)) {
      await this.audit.log({ category: 'security', action: 'privilege_escalation_attempt', description: 'محاولة إدارة مستخدم بدور أعلى', actorId: actor.id, entityType: 'users', entityId: target.id });
      throw new ForbiddenException('لا يمكنك إدارة مستخدم بدور أعلى من صلاحياتك');
    }
  }

  /** At least one active user must keep permissions.assign. */
  private async assertNotLastAssigner(removing: User[]) {
    const holders: User[] = [];
    for (const u of removing) if (u.isActive && (await this.permissions.getRoleCodes(u.roleId)).has(PERM.PERMISSIONS_ASSIGN)) holders.push(u);
    if (!holders.length) return;
    const total = await this.rolesService.countAssigners();
    if (total - holders.length < 1) throw new ConflictException('لا يمكن تعطيل أو حذف أو خفض آخر مستخدم يملك صلاحية تعيين الصلاحيات');
  }

  // ---------- update / activate / delete (users are never created from the admin area) ----------
  async update(id: number, dto: UpdateUserDto, actor: AuthUser) {
    const u = await this.getOrFail(id, false);
    await this.assertCanManage(u, actor);
    const changes: Record<string, any> = {};

    if (dto.roleId !== undefined && dto.roleId !== u.roleId) {
      // changing a role is its own permission, separate from editing name / email / phone
      if (!actor.permissions.has(PERM.USERS_ROLE_CHANGE)) {
        await this.audit.log({ category: 'security', action: 'permission_denied', description: 'محاولة تغيير دور مستخدم دون صلاحية', actorId: actor.id, entityType: 'users', entityId: id });
        throw new ForbiddenException('ليست لديك صلاحية تغيير دور المستخدم');
      }
      await this.assertRoleAssignable(dto.roleId, actor);
      const newCodes = await this.permissions.getRoleCodes(dto.roleId);
      if (!newCodes.has(PERM.PERMISSIONS_ASSIGN)) await this.assertNotLastAssigner([u]);
      changes.roleId = { from: u.roleId, to: dto.roleId };
      u.roleId = dto.roleId;
    }
    if (dto.isActive !== undefined && dto.isActive !== u.isActive) {
      // activating / deactivating is its own permission; users.update alone must not be a way around it
      await this.requirePermission(actor, PERM.USERS_ACTIVATE, id, 'محاولة تفعيل/تعطيل مستخدم دون صلاحية', 'ليست لديك صلاحية تفعيل أو تعطيل المستخدمين');
      if (!dto.isActive) await this.assertNotLastAssigner([u]);
      changes.isActive = dto.isActive;
      u.isActive = dto.isActive;
    }
    if (dto.email && dto.email !== u.email) {
      if (await this.users.findOne({ where: { email: dto.email }, select: { id: true } })) throw new ConflictException('البريد الإلكتروني مسجّل مسبقاً');
      changes.email = true;
      u.email = dto.email;
    }
    if (dto.fullName !== undefined) u.fullName = dto.fullName;
    if (dto.phone !== undefined) u.phone = dto.phone;
    if (dto.password) {
      await this.requirePermission(actor, PERM.USERS_PASSWORD_RESET, id, 'محاولة تغيير كلمة مرور مستخدم دون صلاحية', 'ليست لديك صلاحية تغيير كلمة مرور المستخدم');
      u.passwordHash = await bcrypt.hash(dto.password, 12);
      changes.passwordChanged = true;
    }
    await this.users.save(u);
    await this.audit.log({ category: 'users', action: 'update', description: `تعديل المستخدم ${u.email}`, actorId: actor.id, entityType: 'users', entityId: id, details: changes });
    return this.get(id);
  }

  async setActive(id: number, active: boolean, actor: AuthUser) {
    const u = await this.getOrFail(id, false);
    await this.assertCanManage(u, actor);
    if (!active) await this.assertNotLastAssigner([u]);
    u.isActive = active;
    await this.users.save(u);
    await this.audit.log({ category: 'users', action: active ? 'activate' : 'deactivate', description: `${active ? 'تفعيل' : 'تعطيل'} المستخدم ${u.email}`, actorId: actor.id, entityType: 'users', entityId: id });
    return this.get(id);
  }

  /** Validates every id first; deletes nothing unless all pass. */
  async removeMany(ids: number[], actor: AuthUser) {
    const targets = await this.users.find({ where: { id: In(ids) } });
    if (targets.length !== new Set(ids).size) throw new NotFoundException('بعض المستخدمين غير موجودين');
    for (const t of targets) await this.assertCanManage(t, actor);
    await this.assertNotLastAssigner(targets);
    const withFiles = await this.users.find({ where: { id: In(ids) }, select: { id: true, avatarPath: true, cvPath: true } });
    await this.users.delete(ids);
    await this.storage.removeMany(withFiles.flatMap((x) => [x.avatarPath, x.cvPath]));
    for (const t of targets) {
      await this.audit.log({ category: 'users', action: 'delete', description: `حذف المستخدم ${t.email}`, actorId: actor.id, entityType: 'users', entityId: t.id });
    }
    return { deleted: targets.length };
  }

  // ---------- own profile (SRS FR-USER-003/004) ----------
  async getProfile(userId: number) {
    return this.get(userId);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const u = await this.getOrFail(userId, false);
    if (dto.cityId) {
      if (!(await this.cities.findOne({ where: { id: dto.cityId } }))) throw new BadRequestException('المدينة غير موجودة');
    }
    // role / permissions / is_active are not part of the DTO: they cannot be changed here
    Object.assign(u, dto);
    await this.users.save(u);
    await this.audit.log({ category: 'users', action: 'profile.update', description: 'تحديث الملف الشخصي', actorId: userId, entityType: 'users', entityId: userId });
    return this.get(userId);
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const u = await this.users.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id: userId }).getOne();
    if (!u || !(await bcrypt.compare(dto.currentPassword, u.passwordHash))) throw new UnauthorizedException('كلمة المرور الحالية غير صحيحة');
    u.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.users.save(u);
    await this.audit.log({ category: 'auth', action: 'password.change', description: 'تغيير كلمة المرور', actorId: userId });
    return { message: 'تم تغيير كلمة المرور' };
  }

  async setAvatar(userId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('لم يتم إرسال ملف');
    const u = await this.getOrFail(userId, false);
    const old = u.avatarPath;
    const rel = await this.storage.saveImage(file, 'users', 512);
    try {
      u.avatarPath = rel;
      await this.users.save(u);
    } catch (e) {
      await this.storage.remove(rel);
      throw e;
    }
    await this.storage.remove(old); // old file removed only after the new reference is saved
    await this.audit.log({ category: 'users', action: 'profile.avatar', description: 'تغيير الصورة الشخصية', actorId: userId, entityType: 'users', entityId: userId });
    return { avatarUrl: this.storage.url(rel) };
  }

  async setCv(userId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('لم يتم إرسال ملف');
    const u = await this.getOrFail(userId, false);
    const old = u.cvPath;
    const rel = await this.storage.saveDocument(file, 'private/cv');
    try {
      u.cvPath = rel;
      await this.users.save(u);
    } catch (e) {
      await this.storage.remove(rel);
      throw e;
    }
    await this.storage.remove(old);
    await this.audit.log({ category: 'users', action: 'profile.cv', description: 'رفع السيرة الذاتية', actorId: userId, entityType: 'users', entityId: userId });
    return { hasCv: true, cvUrl: this.storage.url(rel) };
  }
}
