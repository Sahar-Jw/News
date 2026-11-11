import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { AuditService } from '../audit/audit.service';
import { BulkDeleteDto } from '../news/news.dto';
import { ApplicationsAdminQueryDto, ApplyDto, CreateExpoItemDto, ExpoItemsAdminQueryDto, PublicItemsQueryDto, UpdateApplicationDto, UpdateExpoItemDto } from './expo.dto';
import { ExpoService } from './expo.service';

/** one logo in the multipart field "logo" */
const upload = () => FileInterceptor('logo', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fieldSize: 2 * 1024 * 1024 } });

@Controller('admin/expo-items')
export class ExpoItemsAdminController {
  constructor(private readonly service: ExpoService) {}

  @Get()
  @Permissions(PERM.EXPO_READ)
  list(@Query() q: ExpoItemsAdminQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @Permissions(PERM.EXPO_CREATE)
  @UseInterceptors(upload())
  create(@Body() dto: CreateExpoItemDto, @UploadedFile() logo: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, logo, u);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.EXPO_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.EXPO_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpoItemDto, @UploadedFile() logo: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, logo, u);
  }

  @Delete(':id')
  @Permissions(PERM.EXPO_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

const cols = (ar: boolean): ExportColumn[] => [
  { key: 'id', label: '#', value: (r) => r.id },
  { key: 'kind', label: ar ? 'النوع' : 'Type', value: (r) => r.kind },
  { key: 'status', label: ar ? 'الحالة' : 'Status', value: (r) => r.status },
  { key: 'name', label: ar ? 'الاسم' : 'Name', value: (r) => r.name },
  { key: 'company', label: ar ? 'الشركة' : 'Company', value: (r) => r.company },
  { key: 'email', label: ar ? 'البريد الإلكتروني' : 'E-mail', value: (r) => r.email },
  { key: 'phone', label: ar ? 'الهاتف' : 'Phone', value: (r) => r.phone },
  { key: 'jobTitle', label: ar ? 'الصفة الوظيفية' : 'Job title', value: (r) => r.jobTitle },
  { key: 'country', label: ar ? 'الدولة' : 'Country', value: (r) => r.country },
  { key: 'city', label: ar ? 'المدينة' : 'City', value: (r) => r.city },
  { key: 'sector', label: ar ? 'مجال العمل' : 'Business field', value: (r) => r.sector },
  { key: 'products', label: ar ? 'المنتجات / الخدمات' : 'Products / services', value: (r) => r.products },
  { key: 'area', label: ar ? 'المساحة' : 'Area', value: (r) => r.area },
  { key: 'participationType', label: ar ? 'نوع الجناح' : 'Stand type', value: (r) => r.participationType },
  { key: 'interest', label: ar ? 'طبيعة الاهتمام' : 'Interest', value: (r) => r.interest },
  { key: 'inquiryType', label: ar ? 'نوع الاستفسار' : 'Inquiry type', value: (r) => r.inquiryType },
  { key: 'message', label: ar ? 'الرسالة' : 'Message', value: (r) => r.message },
  { key: 'adminNote', label: ar ? 'ملاحظة داخلية' : 'Internal note', value: (r) => r.adminNote },
  { key: 'createdAt', label: ar ? 'تاريخ الطلب' : 'Sent at', value: (r) => r.createdAt },
];

@Controller('admin/expo-applications')
export class ExpoApplicationsAdminController {
  constructor(
    private readonly service: ExpoService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Permissions(PERM.EXPO_APPLICATIONS_READ)
  list(@Query() q: ApplicationsAdminQueryDto) {
    return this.service.listApplications(q);
  }

  @Get('export')
  @Permissions(PERM.EXPO_APPLICATIONS_EXPORT)
  async export(@Query() q: ApplicationsAdminQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const ar = ex.lang !== 'en';
    const picked = pickColumns(cols(ar), ex.columns);
    const rows = await this.service.allApplications(q);
    await this.audit.logExport(u, { category: 'expo', entityType: 'expo_applications', format: ex.format, rowCount: rows.length, columns: picked.map((c) => c.key) });
    return sendExport(res, ex.format, 'expo-applications', picked, rows, ar);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.EXPO_APPLICATIONS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.removeApplications(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.EXPO_APPLICATIONS_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateApplicationDto, @CurrentUser() u: AuthUser) {
    return this.service.updateApplication(id, dto, u);
  }

  @Delete(':id')
  @Permissions(PERM.EXPO_APPLICATIONS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removeApplications([id], u);
  }
}

@Controller('public/expo')
export class ExpoPublicController {
  constructor(private readonly service: ExpoService) {}

  @Public()
  @Get()
  all(@Query() q: PublicItemsQueryDto) {
    return this.service.publicAll(q.lang === 'en' ? 'en' : 'ar');
  }

  // 5 requests / minute / IP, like the contact form
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('apply')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('profile', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fieldSize: 1024 * 1024 } }))
  apply(@Body() dto: ApplyDto, @UploadedFile() profile?: Express.Multer.File) {
    return this.service.apply(dto, profile);
  }
}
