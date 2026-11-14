import { Controller, ForbiddenException, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { basename, extname } from 'path';
import { Readable } from 'stream';
import { Repository } from 'typeorm';
import { PERM } from '../../common/constants';
import { Public } from '../../common/decorators';
import { AuthRequest } from '../../common/types';
import { User } from '../users/user.entity';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from './file-storage.service';
import { UnauthorizedException } from '@nestjs/common';

@Controller('files')
export class FilesController {
  constructor(
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Public files are served by a controlled route; private/ (e.g. CVs) needs permission or ownership. */
  @Public()
  /**
   * `?download=1` (and optionally `&name=My file`) makes ANY file arrive as a download instead of opening in the browser. The HTML
   * `download` attribute cannot do this when the site and the API are on different domains: browsers ignore it for another origin.
   * Private files are always attachments.
   */
  private disposition(req: AuthRequest, rel: string, isPrivate: boolean): string | undefined {
    if (String(req.query?.download ?? '') !== '1') return isPrivate ? 'attachment' : undefined;
    const ext = extname(rel).replace(/[^.A-Za-z0-9]/g, '').slice(0, 10);
    let name = String(req.query?.name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!name) name = basename(rel);
    else if (ext && !name.toLowerCase().endsWith(ext.toLowerCase())) name += ext;
    const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
  }

  @Get('*path')
  async serve(@Param('path') p: string | string[], @Req() req: AuthRequest, @Res() res: Response) {
    const rel = Array.isArray(p) ? p.join('/') : p;
    const abs = this.storage.resolveSafe(rel);
    if (!abs) throw new NotFoundException('الملف غير موجود');

    const isPrivate = this.storage.isPrivate(rel);
    if (isPrivate) {
      if (!req.user) throw new UnauthorizedException('يلزم تسجيل الدخول');
      const membershipDoc = rel.startsWith('private/membership/');
      const trainerDoc = rel.startsWith('private/trainers/'); // CV and certificates of a trainer application
      const incubatorDoc = rel.startsWith('private/incubator/'); // project profile / study of an incubator application
      const formDoc = rel.startsWith('private/forms/'); // attachments of a dashboard-managed form: personal documents, so the sensitive permission is needed too
      const mayRead = formDoc ? req.user.permissions.has(PERM.FORMS_SUBMISSIONS_READ) && req.user.permissions.has(PERM.FORMS_SUBMISSIONS_SENSITIVE) : membershipDoc ? req.user.permissions.has(PERM.MEMBERSHIP_READ) : trainerDoc ? req.user.permissions.has(PERM.REGISTRATIONS_READ) : incubatorDoc ? req.user.permissions.has(PERM.INCUBATOR_APPLICATIONS_READ) : req.user.permissions.has(PERM.USERS_CV_DOWNLOAD);
      const owner = membershipDoc || trainerDoc || incubatorDoc || formDoc ? null : await this.users.findOne({ where: { cvPath: rel }, select: { id: true } });
      if (!mayRead && owner?.id !== req.user.id) throw new ForbiddenException('ليست لديك صلاحية لهذا الملف');
      // only private files (CVs) are logged; public pictures are served thousands of times and are not sensitive
      await this.audit.log({ category: 'files', action: 'private.download', description: formDoc ? 'تنزيل مرفق طلب نموذج' : membershipDoc ? 'تنزيل مرفق طلب انتساب' : trainerDoc ? 'تنزيل مرفق طلب مدرب' : incubatorDoc ? 'تنزيل مرفق طلب حاضنة' : 'تنزيل ملف خاص (سيرة ذاتية)', actorId: req.user.id, entityType: formDoc ? 'form_submission_files' : membershipDoc ? 'membership_files' : trainerDoc ? 'trainer_applications' : incubatorDoc ? 'incubator_applications' : 'users', entityId: owner?.id ?? null, details: { ownFile: owner?.id === req.user.id } });
    }

    if (this.storage.driver === 's3') {
      // look the file up BEFORE setting cache headers, so a 404 is never cached for a week
      const f = await this.storage.openS3(rel, req.headers['if-none-match']);
      if (!f) throw new NotFoundException('الملف غير موجود');
      const cache = isPrivate ? 'private, no-store' : 'public, max-age=604800';
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', cache);
      if (f.etag) res.setHeader('ETag', f.etag);
      if (f.notModified) {
        res.status(304).end();
        return;
      }
      res.setHeader('Content-Type', f.contentType);
      if (f.contentLength != null) res.setHeader('Content-Length', String(f.contentLength));
      if (f.lastModified) res.setHeader('Last-Modified', f.lastModified.toUTCString());
      const disposition = this.disposition(req, rel, isPrivate);
      if (disposition) res.setHeader('Content-Disposition', disposition);
      const body = f.body as Readable;
      res.on('close', () => body.destroy()); // client went away: stop reading from the bucket
      body.on('error', () => res.destroy());
      body.pipe(res);
      return;
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', isPrivate ? 'private, no-store' : 'public, max-age=604800');
    const disposition = this.disposition(req, rel, isPrivate);
    if (disposition) res.setHeader('Content-Disposition', disposition);
    res.sendFile(abs, { dotfiles: 'deny' }, (err) => {
      if (err && !res.headersSent) res.status(404).json({ statusCode: 404, error: 'Not Found', message: 'الملف غير موجود' });
    });
  }
}
