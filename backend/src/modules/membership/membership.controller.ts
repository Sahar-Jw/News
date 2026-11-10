import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
import { ApplyDto, MembershipAdminQueryDto, UpdateApplicationDto, UpdateMembershipSettingsDto } from './membership.dto';
import { MAX_APPLICATION_FILES, MembershipService } from './membership.service';

const cols = (ar: boolean): ExportColumn[] => [
  { key: 'reference', label: ar ? 'رقم الطلب' : 'Reference', value: (r) => r.reference },
  { key: 'companyName', label: ar ? 'المنشأة' : 'Company', value: (r) => r.companyName },
  { key: 'activity', label: ar ? 'النشاط' : 'Activity', value: (r) => r.activity },
  { key: 'managerName', label: ar ? 'صاحب المنشأة / المفوض' : 'Owner / signatory', value: (r) => r.managerName },
  { key: 'businessType', label: ar ? 'نوع المنشأة' : 'Business type', value: (r) => (r.businessType === 'other' ? r.businessTypeOther ?? '' : r.businessType ?? '') },
  { key: 'commercialRegNo', label: ar ? 'رقم السجل التجاري' : 'Commercial register no.', value: (r) => r.commercialRegNo ?? '' },
  { key: 'registrationDate', label: ar ? 'تاريخ التسجيل' : 'Registration date', value: (r) => r.registrationDate ?? '' },
  { key: 'contactPerson', label: ar ? 'المفوض بالتواصل' : 'Contact person', value: (r) => r.contactPerson ?? '' },
  { key: 'phone', label: ar ? 'الهاتف' : 'Phone', value: (r) => r.phone },
  { key: 'email', label: ar ? 'البريد' : 'Email', value: (r) => r.email },
  { key: 'address', label: ar ? 'العنوان' : 'Address', value: (r) => r.address ?? '' },
  { key: 'status', label: ar ? 'الحالة' : 'Status', value: (r) => r.status },
  { key: 'createdAt', label: ar ? 'تاريخ الطلب' : 'Submitted at', value: (r) => r.createdAt },
];

@Controller('admin/membership')
export class MembershipAdminController {
  constructor(private readonly service: MembershipService, private readonly audit: AuditService) {}

  @Get('applications')
  @Permissions(PERM.MEMBERSHIP_READ)
  list(@Query() q: MembershipAdminQueryDto) {
    return this.service.list(q);
  }

  @Get('applications/export')
  @Permissions(PERM.MEMBERSHIP_EXPORT)
  async export(@Query() q: MembershipAdminQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const ar = ex.lang !== 'en';
    const columns = pickColumns(cols(ar), ex.columns);
    const rows = await this.service.listAll(q);
    await this.audit.logExport(u, { category: 'membership', entityType: 'membership_applications', format: ex.format, rowCount: rows.length, columns: columns.map((c) => c.key) });
    return sendExport(res, ex.format, 'membership-applications', columns, rows, ar);
  }

  @Post('applications/bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.MEMBERSHIP_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Get('applications/:id')
  @Permissions(PERM.MEMBERSHIP_READ)
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.one(id);
  }

  @Patch('applications/:id')
  @Permissions(PERM.MEMBERSHIP_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateApplicationDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Delete('applications/:id')
  @Permissions(PERM.MEMBERSHIP_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove([id], u);
  }

  @Get('settings')
  @Permissions(PERM.MEMBERSHIP_READ)
  settings() {
    return this.service.getSettings();
  }

  @Patch('settings')
  @Permissions(PERM.MEMBERSHIP_UPDATE)
  updateSettings(@Body() dto: UpdateMembershipSettingsDto, @CurrentUser() u: AuthUser) {
    return this.service.updateSettings(dto, u);
  }
}

@Controller('public/membership')
export class MembershipPublicController {
  constructor(private readonly service: MembershipService) {}

  @Public()
  @Get()
  page(@Query('lang') lang?: string) {
    return this.service.publicPage(lang === 'en' ? 'en' : 'ar');
  }

  // 3 applications / 10 minutes / IP: a real applicant sends one
  @Public()
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @Post('apply')
  @UseInterceptors(FilesInterceptor('files', MAX_APPLICATION_FILES, { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_APPLICATION_FILES, fieldSize: 1024 * 1024 } }))
  apply(@Body() dto: ApplyDto, @UploadedFiles() files: Express.Multer.File[] | undefined) {
    return this.service.apply(dto, files ?? []);
  }
}
