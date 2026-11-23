import { Controller, Delete, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
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
    return { status: await this.service.status(), data: await this.service.list() };
  }

  @Post()
  @HttpCode(200)
  @Permissions('backups.create')
  create(@CurrentUser() u: AuthUser) {
    return this.service.run('manual', u);
  }

  /** db = a ZIP with the restorable .sql (?encrypted=1: password-protected ZIP); files = the uploaded files as .tar.gz (decrypted) */
  @Get(':id/:kind')
  @Permissions('backups.download')
  async download(@Param('id') id: string, @Param('kind') kind: string, @Query('encrypted') encrypted: string | undefined, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const { name, stream } = kind === 'files'
      ? await this.service.fileOf(id, 'files', u, true)
      : await this.service.sqlZip(id, u, encrypted === '1' || encrypted === 'true');
    res.setHeader('Content-Type', kind === 'files' ? 'application/gzip' : 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy()); // the browser gave up: stop reading (and let the work file go)
    stream.pipe(res);
  }

  @Delete(':id')
  @Permissions('backups.delete')
  remove(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}
