import { ConflictException, ForbiddenException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Role } from '../access/role.entity';
import { User } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../access/permissions.service';
import { FileStorageService } from '../files/file-storage.service';
import { LoginDto, RegisterDto } from './auth.dto';

// Used to equalise timing when the e-mail does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly perms: PermissionsService,
    private readonly storage: FileStorageService,
  ) {}

  async register(dto: RegisterDto) {
    if (await this.users.findOne({ where: { email: dto.email }, select: { id: true } })) {
      throw new ConflictException('البريد الإلكتروني مسجّل مسبقاً');
    }
    const code = this.config.get<string>('DEFAULT_ROLE_CODE', 'registered');
    const role = await this.roles.findOne({ where: { code } });
    if (!role) throw new InternalServerErrorException('إعدادات النظام غير مكتملة (الدور الافتراضي غير موجود)');

    const user = await this.users.save(
      this.users.create({
        fullName: dto.fullName,
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 12),
        phone: dto.phone ?? null,
        roleId: role.id,
        isActive: false, // SRS FR-AUTH-002: pending until an authorised admin activates
      }),
    );
    await this.audit.log({ category: 'auth', action: 'register', description: 'تسجيل حساب جديد بانتظار التفعيل', actorId: user.id, entityType: 'users', entityId: user.id });
    return { message: 'تم إنشاء الحساب وهو بانتظار التفعيل من المسؤول' };
  }

  async login(dto: LoginDto) {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .leftJoinAndSelect('u.role', 'role')
      .leftJoinAndSelect('u.city', 'city')
      .where('u.email = :email', { email: dto.email })
      .getOne();

    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
      await this.audit.log({ category: 'auth', action: 'login.failed', description: 'محاولة دخول فاشلة', details: { email: dto.email } });
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    if (!user.isActive) {
      await this.audit.log({ category: 'auth', action: 'login.inactive', description: 'محاولة دخول بحساب غير مفعّل', actorId: user.id });
      throw new ForbiddenException('الحساب بانتظار التفعيل');
    }

    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '8h');
    const accessToken = await this.jwt.signAsync({ sub: user.id });
    await this.audit.log({ category: 'auth', action: 'login', description: 'تسجيل دخول', actorId: user.id });
    return { accessToken, expiresIn, user: await this.toMe(user) };
  }

  async me(userId: number) {
    const user = await this.users.findOne({ where: { id: userId }, relations: { role: true, city: true } });
    return this.toMe(user);
  }

  async toMe(user: User) {
    const permissions = [...(await this.perms.getRoleCodes(user.roleId))].sort();
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      country: user.country,
      city: user.city ? { id: user.city.id, code: user.city.code, nameAr: user.city.nameAr, nameEn: user.city.nameEn } : null,
      nationality: user.nationality,
      role: user.role ? { id: user.role.id, code: user.role.code, nameAr: user.role.nameAr, nameEn: user.role.nameEn } : null,
      isActive: user.isActive,
      avatarUrl: this.storage.url(user.avatarPath),
      hasCv: !!user.cvPath,
      bio: user.bio,
      socialLink: user.socialLink,
      isExpert: user.isExpert,
      isResearcher: user.isResearcher,
      permissions,
    };
  }
}
