import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { sendExport } from '../../common/utils/export';
import { AuditService } from '../audit/audit.service';
import { BulkIdsDto, BulkStatusDto, ContactApplicantDto, DuplicateFormDto, SaveFormDto, SubmissionsQueryDto, SubmitFormDto, UpdateSubmissionDto } from './forms.dto';
import { FormsService } from './forms.service';

@Controller('admin/forms')
export class FormsAdminController {
  constructor(private readonly service: FormsService, private readonly audit: AuditService) {}

  // ---- form definitions
  @Get()
  @Permissions('forms.read')
  list() {
    return this.service.list();
  }

  @Post()
  @Permissions('forms.create')
  create(@Body() dto: SaveFormDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }

  // ---- submissions (declared before :id so "submissions" is never read as an id)
  @Get('unread')
  @Permissions('forms.submissions.read')
  unread() {
    return this.service.unread();
  }

  @Get('submissions')
  @Permissions('forms.submissions.read')
  submissions(@Query() q: SubmissionsQueryDto) {
    return this.service.listSubmissions(q);
  }

  @Get('submissions/export')
  @Permissions('forms.submissions.export')
  async export(@Query() q: SubmissionsQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const ar = ex.lang !== 'en';
    const { rows, columns } = await this.service.exportRows(q, u, ar);
    await this.audit.logExport(u, { category: 'forms', entityType: 'form_submissions', format: ex.format ?? 'xlsx', rowCount: rows.length, columns: columns.map((c) => c.key) });
    return sendExport(res, ex.format ?? 'xlsx', 'form-submissions', columns, rows, ar);
  }

  @Post('submissions/bulk-update')
  @HttpCode(200)
  @Permissions('forms.submissions.update')
  bulkUpdate(@Body() dto: BulkStatusDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkUpdate(dto.ids, { status: dto.status, category: dto.category }, u);
  }

  @Post('submissions/bulk-delete')
  @HttpCode(200)
  @Permissions('forms.submissions.delete')
  bulkDelete(@Body() dto: BulkIdsDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Get('submissions/:id')
  @Permissions('forms.submissions.read')
  one(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.oneSubmission(id, u);
  }

  @Patch('submissions/:id')
  @Permissions('forms.submissions.update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSubmissionDto, @CurrentUser() u: AuthUser) {
    return this.service.updateSubmission(id, dto, u);
  }

  @Post('submissions/:id/contact')
  @HttpCode(200)
  @Permissions('forms.submissions.contact')
  contact(@Param('id', ParseIntPipe) id: number, @Body() dto: ContactApplicantDto, @CurrentUser() u: AuthUser) {
    return this.service.contact(id, dto, u);
  }

  @Post('submissions/:id/anonymize')
  @HttpCode(200)
  @Permissions('forms.submissions.delete')
  anonymize(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.anonymize(id, u);
  }

  @Delete('submissions/:id')
  @Permissions('forms.submissions.delete')
  removeSubmission(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove([id], u);
  }

  // ---- one form
  @Get(':id')
  @Permissions('forms.read')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.one(id);
  }

  @Patch(':id')
  @Permissions('forms.update')
  edit(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveFormDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Post(':id/duplicate')
  @HttpCode(200)
  @Permissions('forms.create')
  duplicate(@Param('id', ParseIntPipe) id: number, @Body() dto: DuplicateFormDto, @CurrentUser() u: AuthUser) {
    return this.service.duplicate(id, dto.slug, u);
  }

  @Delete(':id')
  @Permissions('forms.delete')
  remove(@Param('id', ParseIntPipe) id: number, @Query('deleteSubmissions') del: string | undefined, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, del === 'true', u);
  }
}

@Controller('public/forms')
export class FormsPublicController {
  constructor(private readonly service: FormsService) {}

  @Public()
  @Get()
  list(@Query('lang') lang?: string) {
    return this.service.publicList(lang === 'en' ? 'en' : 'ar');
  }

  @Public()
  @Get(':slug')
  one(@Param('slug') slug: string) {
    return this.service.publicOne(slug);
  }

  // 10 submissions / 10 minutes / IP; every file field of the form arrives as f_<fieldKey>
  @Public()
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @Post(':slug/submit')
  @UseInterceptors(AnyFilesInterceptor({ storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 60, fieldSize: 512 * 1024, fields: 10 } }))
  submit(@Param('slug') slug: string, @Body() dto: SubmitFormDto, @UploadedFiles() files: Express.Multer.File[] | undefined) {
    return this.service.submit(slug, dto, files ?? []);
  }
}
