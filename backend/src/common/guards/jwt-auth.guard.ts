import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IS_PUBLIC } from '../decorators';
import { User } from '../../modules/users/user.entity';
import { PermissionsService } from '../../modules/access/permissions.service';
import { AuthRequest } from '../types';

export const AUTH_COOKIE = 'access_token';

export function extractToken(req: AuthRequest): string | null {
  const h = req.headers.authorization;
  if (h && h.startsWith('Bearer ')) return h.slice(7).trim() || null;
  const c = (req as any).cookies?.[AUTH_COOKIE];
  return typeof c === 'string' && c ? c : null;
}

/**
 * Global guard. Protected routes need a valid JWT and an active account.
 * @Public routes accept anonymous calls but still attach req.user when a valid token is sent.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly perms: PermissionsService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    const token = extractToken(req);

    const fail = (msg: string) => {
      if (isPublic) return true;
      throw new UnauthorizedException(msg);
    };
    if (!token) return fail('يلزم تسجيل الدخول');

    let sub: number;
    let iat = 0;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: number | string; iat?: number }>(token);
      iat = Number(payload.iat) || 0;
      sub = Number(payload.sub);
      if (!Number.isFinite(sub)) throw new Error('bad sub');
    } catch {
      return fail('انتهت صلاحية الجلسة أو الرمز غير صالح');
    }

    const user = await this.users.findOne({
      where: { id: sub },
      select: { id: true, email: true, fullName: true, roleId: true, isActive: true, passwordChangedAt: true },
    });
    if (!user || !user.isActive) return fail('الحساب غير مفعّل أو غير موجود');
    // the password was reset after this session started (iat is in seconds)
    if (user.passwordChangedAt && iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) return fail('انتهت صلاحية الجلسة، سجّل الدخول من جديد');

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
      permissions: await this.perms.getRoleCodes(user.roleId),
    };
    return true;
  }
}
