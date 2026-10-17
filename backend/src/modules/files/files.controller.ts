import { Controller, ForbiddenException, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { PERM } from '../../common/constants';
import { Public } from '../../common/decorators';
import { AuthRequest } from '../../common/types';
import { User } from '../users/user.entity';
import { FileStorageService } from './file-storage.service';
import { UnauthorizedException } from '@nestjs/common';

@Controller('files')
export class FilesController {
  constructor(
    private readonly storage: FileStorageService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Public files are served by a controlled route; private/ (e.g. CVs) needs permission or ownership. */
  @Public()
  @Get('*path')
  async serve(@Param('path') p: string | string[], @Req() req: AuthRequest, @Res() res: Response) {
    const rel = Array.isArray(p) ? p.join('/') : p;
    const abs = this.storage.resolveSafe(rel);
    if (!abs) throw new NotFoundException('الملف غير موجود');

    const isPrivate = this.storage.isPrivate(rel);
    if (isPrivate) {
      if (!req.user) throw new UnauthorizedException('يلزم تسجيل الدخول');
      const mayRead = req.user.permissions.has(PERM.USERS_READ);
      const owner = await this.users.findOne({ where: { cvPath: rel }, select: { id: true } });
      if (!mayRead && owner?.id !== req.user.id) throw new ForbiddenException('ليست لديك صلاحية لهذا الملف');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', isPrivate ? 'private, no-store' : 'public, max-age=604800');
    if (isPrivate) res.setHeader('Content-Disposition', 'attachment');
    res.sendFile(abs, { dotfiles: 'deny' }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'الملف غير موجود' });
    });
  }
}
