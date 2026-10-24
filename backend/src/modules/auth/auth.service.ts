import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Role } from '../access/role.entity';
import { User } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../access/permissions.service';
import { FileStorageService } from '../files/file-storage.service';
import { MailService } from '../mail/mail.service';
import { PasswordReset } from './password-reset.entity';
import { LoginDto, RegisterDto } from './auth.dto';

const RESET_TTL_MS = 60 * 60 * 1000; // a reset link works for one hour
const RESET_COOLDOWN_MS = 60 * 1000; // at most one e-mail per minute per account
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

// Used to equalise timing when the e-mail does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(PasswordReset) private readonly resets: Repository<PasswordReset>,
    private readonly mail: MailService,
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

  private front() {
    return (process.env.FRONTEND_URL || (process.env.CORS_ORIGINS ?? '').split(',')[0] || '').trim().replace(/\/+$/, '');
  }

  /** Always answers the same way, so the form cannot be used to find out which e-mails have an account. */
  async forgotPassword(email: string, lang: 'ar' | 'en') {
    const ar = lang === 'ar';
    const answer = { message: ar ? 'إذا كان البريد مسجّلاً لدينا فقد أرسلنا إليه رابط إعادة تعيين كلمة المرور.' : 'If this e-mail is registered, we sent it a link to reset the password.' };
    const user = await this.users.findOne({ where: { email }, select: { id: true, email: true, fullName: true, isActive: true } });
    // The caller always gets the same answer, but the log keeps what really happened (it is only visible to auditors).
    const ignored = (reason: 'unknown_email' | 'inactive_account' | 'cooldown', actorId?: number) =>
      this.audit.log({ category: 'auth', action: 'password.reset.request.ignored', description: 'طلب إعادة تعيين كلمة المرور لم يُنفَّذ', actorId: actorId ?? null, details: { reason, ...(actorId ? {} : { email }) } });
    if (!user) {
      await ignored('unknown_email');
      return answer;
    }
    if (!user.isActive) {
      await ignored('inactive_account', user.id); // pending accounts cannot sign in anyway
      return answer;
    }
    const recent = await this.resets.findOne({ where: { userId: user.id, usedAt: IsNull() }, order: { id: 'DESC' } });
    if (recent && Date.now() - recent.createdAt.getTime() < RESET_COOLDOWN_MS) {
      await ignored('cooldown', user.id);
      return answer;
    }

    const token = randomBytes(32).toString('hex');
    await this.resets.delete({ userId: user.id, usedAt: IsNull() }); // only the newest link works
    await this.resets.save(this.resets.create({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS), usedAt: null }));
    const link = `${this.front()}/${lang}/reset-password/?token=${token}`;
    const html = `<div dir="${ar ? 'rtl' : 'ltr'}" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#1f2937;max-width:520px;margin:auto">
      <p>${ar ? 'مرحباً،' : 'Hello,'}</p>
      <p>${ar ? 'وصلنا طلب لإعادة تعيين كلمة المرور لحسابك. اضغط الزر أدناه لاختيار كلمة مرور جديدة (الرابط صالح لمدة ساعة واحدة):' : 'We received a request to reset the password of your account. Press the button below to choose a new one (the link is valid for one hour):'}</p>
      <p style="text-align:center;margin:28px 0"><a href="${link}" style="background:#2748e8;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">${ar ? 'إعادة تعيين كلمة المرور' : 'Reset password'}</a></p>
      <p style="color:#6b7280;font-size:13px">${ar ? 'إذا لم يعمل الزر، انسخ هذا الرابط إلى المتصفح:' : 'If the button does not work, copy this link into your browser:'}<br><a href="${link}">${link}</a></p>
      <p style="color:#9ca3af;font-size:12px">${ar ? 'إذا لم تطلب ذلك فتجاهل هذه الرسالة، ولن يتغيّر شيء في حسابك.' : 'If you did not ask for this, ignore this message: nothing changes in your account.'}</p></div>`;
    await this.mail.send(user.email, ar ? 'إعادة تعيين كلمة المرور' : 'Reset your password', html);
    await this.audit.log({ category: 'auth', action: 'password.reset.request', description: 'طلب إعادة تعيين كلمة المرور', actorId: user.id });
    return answer;
  }

  async resetPassword(token: string, password: string) {
    const bad = new BadRequestException('الرابط غير صالح أو منتهي، اطلب رابطاً جديداً');
    const row = await this.resets.findOne({ where: { tokenHash: sha256(token), usedAt: IsNull(), expiresAt: MoreThan(new Date()) } });
    if (!row) throw bad;
    // claim the link first: two requests with the same link cannot both succeed
    const claimed = await this.resets.update({ id: row.id, usedAt: IsNull() }, { usedAt: new Date() });
    if (!claimed.affected) throw bad;
    const now = new Date();
    await this.users.update({ id: row.userId }, { passwordHash: await bcrypt.hash(password, 12), passwordChangedAt: now });
    await this.resets.delete({ userId: row.userId }); // every other open link of this account is void too
    await this.audit.log({ category: 'auth', action: 'password.reset', description: 'إعادة تعيين كلمة المرور عبر البريد', actorId: row.userId });
    return { message: 'تم تغيير كلمة المرور، يمكنك تسجيل الدخول الآن' };
  }

  async logout(userId: number) {
    await this.audit.log({ category: 'auth', action: 'logout', description: 'تسجيل خروج', actorId: userId });
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
