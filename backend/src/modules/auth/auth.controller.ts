import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser, Public } from '../../common/decorators';
import { AUTH_COOKIE } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';

function ttlToMs(v: string): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec(v.trim());
  if (!m) return 8 * 3600_000;
  const n = Number(m[1]);
  return n * ({ '': 1000, s: 1000, m: 60_000, h: 3600_000, d: 86_400_000 } as any)[m[2]];
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // SEC-NFR-007: 5 login attempts / minute / IP
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    res.cookie(AUTH_COOKIE, result.accessToken, {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE') === 'true',
      sameSite: this.config.get('COOKIE_SAMESITE', 'lax') as 'lax' | 'strict' | 'none',
      maxAge: ttlToMs(result.expiresIn),
      path: '/',
    });
    return result;
  }

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u.id);
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE') === 'true',
      sameSite: this.config.get('COOKIE_SAMESITE', 'lax') as 'lax' | 'strict' | 'none',
      path: '/',
    });
    return { message: 'تم تسجيل الخروج' };
  }
}
