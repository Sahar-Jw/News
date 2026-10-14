import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../modules/audit/audit.service';
import { REQUIRED_PERMISSIONS } from '../decorators';
import { AuthRequest } from '../types';

/** Server-side RBAC. A route passes when the user holds ANY of the listed permission codes. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [ctx.getHandler(), ctx.getClass()]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<AuthRequest>();
    if (!req.user) throw new UnauthorizedException('يلزم تسجيل الدخول');
    if (required.some((c) => req.user.permissions.has(c))) return true;

    await this.audit.log({
      category: 'security',
      action: 'permission_denied',
      description: 'محاولة وصول مرفوضة لعدم وجود الصلاحية',
      actorId: req.user.id,
      details: { method: req.method, path: req.originalUrl?.split('?')[0], required },
    });
    throw new ForbiddenException('ليست لديك صلاحية لتنفيذ هذا الإجراء');
  }
}
