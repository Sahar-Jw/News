import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthRequest, AuthUser } from '../types';

export const IS_PUBLIC = 'isPublic';
/** Route is open to everyone. A valid token (if sent) still populates req.user. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const REQUIRED_PERMISSIONS = 'requiredPermissions';
/** Route requires ANY of the listed permission codes. */
export const Permissions = (...codes: string[]) => SetMetadata(REQUIRED_PERMISSIONS, codes);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest<AuthRequest>().user;
});
