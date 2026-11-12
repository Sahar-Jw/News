import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser, Public } from '../../common/decorators';
import { AUTH_COOKIE } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/types';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from './auth.dto';
import { AuthService, ttlToMs } from './auth.service';

const REFRESH_COOKIE = 'refresh_token';
/** The refresh cookie is only sent to the auth endpoints (the API prefix is /api); REFRESH_COOKIE_PATH overrides it when a proxy changes the prefix. */
const DEFAULT_REFRESH_PATH = '/api/auth';

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
    const { refresh, ...result } = await this.auth.login(dto);
    this.setCookies(res, result.accessToken, result.expiresIn, refresh);
    return result;
  }

  /** Silent renewal of the short sign-in cookie from the refresh cookie (public: the access cookie is the thing that ran out). */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { refresh, ...result } = await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]);
      this.setCookies(res, result.accessToken, result.expiresIn, refresh);
      return { user: result.user };
    } catch (e) {
      this.clearCookies(res); // an unusable refresh cookie is removed, so the browser stops sending it
      throw e;
    }
  }

  private get refreshPath() {
    return this.config.get<string>('REFRESH_COOKIE_PATH') || DEFAULT_REFRESH_PATH;
  }

  private cookieBase() {
    return {
      httpOnly: true,
      secure: this.config.get('COOKIE_SECURE') === 'true',
      sameSite: this.config.get('COOKIE_SAMESITE', 'lax') as 'lax' | 'strict' | 'none',
    };
  }

  private setCookies(res: Response, accessToken: string, expiresIn: string, refresh: { token: string; maxAgeMs: number }) {
    res.cookie(AUTH_COOKIE, accessToken, { ...this.cookieBase(), maxAge: ttlToMs(expiresIn), path: '/' });
    res.cookie(REFRESH_COOKIE, refresh.token, { ...this.cookieBase(), maxAge: refresh.maxAgeMs, path: this.refreshPath });
  }

  private clearCookies(res: Response) {
    res.clearCookie(AUTH_COOKIE, { ...this.cookieBase(), path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...this.cookieBase(), path: this.refreshPath });
  }

  // password reset by e-mail: 5 requests / minute / IP, always the same answer
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email, dto.lang === 'en' ? 'en' : 'ar');
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u.id);
  }

  // public: the access cookie may already have run out, and signing out must still clear the cookies and end the refresh token
  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser() u?: AuthUser) {
    await this.auth.logout(u?.id, req.cookies?.[REFRESH_COOKIE]);
    this.clearCookies(res);
    return { message: '\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c' };
  }
}
