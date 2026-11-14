import { Controller, Delete, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser, Permissions } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BackupService } from './backup.service';

@Controller('admin/backups')
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Get()
  @Permissions('backups.read')
  async list() {
    return { status: this.service.status(), data: await this.service.list() };
  }

  @Post()
  @HttpCode(200)
  @Permissions('backups.create')
  create(@CurrentUser() u: AuthUser) {
    return this.service.run('manual', u);
  }

  @Get(':id/:kind')
  @Permissions('backups.download')
  async download(@Param('id') id: string, @Param('kind') kind: string, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const { name, stream } = await this.service.fileOf(id, kind === 'files' ? 'files' : 'db', u);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  @Delete(':id')
  @Permissions('backups.delete')
  remove(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}
