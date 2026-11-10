import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { MAX_DOC_BYTES, MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { AuditService } from '../audit/audit.service';
import { BulkDeleteDto } from '../news/news.dto';
import { ApplicationsAdminQueryDto, ApplyDto, CreateProjectDto, ProjectsAdminQueryDto, PublicQueryDto, UpdateApplicationDto, UpdateProjectDto } from './incubator.dto';
import { IncubatorService } from './incubator.service';

/** one picture in the multipart field "image" */
const upload = () => FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fieldSize: 2 * 1024 * 1024 } });

@Controller('admin/incubator-projects')
export class IncubatorProjectsAdminController {
  constructor(private readonly service: IncubatorService) {}

  @Get()
  @Permissions(PERM.INCUBATOR_READ)
  list(@Query() q: ProjectsAdminQueryDto) {
    return this.service.listProjects(q);
  }

  @Post()
  @Permissions(PERM.INCUBATOR_CREATE)
  @UseInterceptors(upload())
  create(@Body() dto: CreateProjectDto, @UploadedFile() image: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.createProject(dto, image, u);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.INCUBATOR_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.removeProjects(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.INCUBATOR_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto, @UploadedFile() image: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.updateProject(id, dto, image, u);
  }

  @Delete(':id')
  @Permissions(PERM.INCUBATOR_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removeProjects([id], u);
  }
}

const cols = (ar: boolean): ExportColumn[] => [
  { key: 'reference', label: ar ? 'رقم الطلب' : 'Reference', value: (r) => r.reference },
  { key: 'status', label: ar ? 'الحالة' : 'Status', value: (r) => r.status },
  { key: 'projectName', label: ar ? 'المشروع' : 'Project', value: (r) => r.projectName },
  { key: 'founderName', label: ar ? 'رائد الأعمال' : 'Founder', value: (r) => r.founderName },
  { key: 'email', label: ar ? 'البريد الإلكتروني' : 'E-mail', value: (r) => r.email },
  { key: 'phone', label: ar ? 'الهاتف' : 'Phone', value: (r) => r.phone },
  { key: 'sector', label: ar ? 'القطاع' : 'Sector', value: (r) => r.sector },
  { key: 'stage', label: ar ? 'المرحلة' : 'Stage', value: (r) => r.stage },
  { key: 'description', label: ar ? 'وصف المشروع' : 'Description', value: (r) => r.description },
  { key: 'feasibility', label: ar ? 'الجدوى الاقتصادية' : 'Economic feasibility', value: (r) => r.feasibility },
  { key: 'targetAudience', label: ar ? 'الفئة المستهدفة' : 'Target audience', value: (r) => r.targetAudience },
  { key: 'team', label: ar ? 'فريق العمل' : 'Team', value: (r) => r.team },
  { key: 'needs', label: ar ? 'الاحتياجات المطلوبة' : 'Needs from the incubator', value: (r) => r.needs },
  { key: 'hasProfile', label: ar ? 'مرفق ملف تعريفي' : 'Profile attached', value: (r) => (r.hasProfile ? (ar ? 'نعم' : 'Yes') : ar ? 'لا' : 'No') },
  { key: 'adminNote', label: ar ? 'ملاحظة داخلية' : 'Internal note', value: (r) => r.adminNote },
  { key: 'createdAt', label: ar ? 'تاريخ الطلب' : 'Sent at', value: (r) => r.createdAt },
];

@Controller('admin/incubator-applications')
export class IncubatorApplicationsAdminController {
  constructor(
    private readonly service: IncubatorService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Permissions(PERM.INCUBATOR_APPLICATIONS_READ)
  list(@Query() q: ApplicationsAdminQueryDto) {
    return this.service.listApplications(q);
  }

  @Get('export')
  @Permissions(PERM.INCUBATOR_APPLICATIONS_EXPORT)
  async export(@Query() q: ApplicationsAdminQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const ar = ex.lang !== 'en';
    const picked = pickColumns(cols(ar), ex.columns);
    const rows = await this.service.allApplications(q);
    await this.audit.logExport(u, { category: 'incubator', entityType: 'incubator_applications', format: ex.format, rowCount: rows.length, columns: picked.map((c) => c.key) });
    return sendExport(res, ex.format, 'incubator-applications', picked, rows, ar);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.INCUBATOR_APPLICATIONS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.removeApplications(dto.ids, u);
  }

  @Get(':id')
  @Permissions(PERM.INCUBATOR_APPLICATIONS_READ)
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.oneApplication(id);
  }

  @Patch(':id')
  @Permissions(PERM.INCUBATOR_APPLICATIONS_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateApplicationDto, @CurrentUser() u: AuthUser) {
    return this.service.updateApplication(id, dto, u);
  }

  @Delete(':id')
  @Permissions(PERM.INCUBATOR_APPLICATIONS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removeApplications([id], u);
  }
}

@Controller('public/incubator')
export class IncubatorPublicController {
  constructor(private readonly service: IncubatorService) {}

  @Public()
  @Get()
  all(@Query() q: PublicQueryDto) {
    return this.service.publicAll(q.lang === 'en' ? 'en' : 'ar');
  }

  // 5 requests / minute / IP, like the contact form
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('apply')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('profile', { storage: memoryStorage(), limits: { fileSize: MAX_DOC_BYTES, files: 1, fieldSize: 1024 * 1024 } }))
  apply(@Body() dto: ApplyDto, @UploadedFile() profile: Express.Multer.File | undefined) {
    return this.service.apply(dto, profile);
  }
}
