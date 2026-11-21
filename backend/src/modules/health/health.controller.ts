import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators';

/**
 * For the hosting panel / uptime monitor (no login, not rate limited):
 *  - GET /api/health        - the API process is up (always 200);
 *  - GET /api/health/ready  - the API can reach its database (503 while the database is down or still starting).
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Public()
  @Get()
  live() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }

  @Public()
  @Get('ready')
  async ready() {
    try {
      await Promise.race([
        this.db.query('SELECT 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('database did not answer within 3 seconds')), 3000)),
      ]);
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException('قاعدة البيانات غير متاحة حالياً');
    }
  }
}
