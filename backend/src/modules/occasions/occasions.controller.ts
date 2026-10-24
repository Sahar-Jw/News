import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { MAX_FILES_PER_UPLOAD, MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { AuditService } from '../audit/audit.service';
import { BulkDeleteDto } from '../news/news.dto';
import { CreateOccasionDto, OccasionsAdminQueryDto, PublicOccasionsQueryDto, UpdateOccasionDto } from './occasions.dto';
import { OccasionsService } from './occasions.service';

const upload = () => FilesInterceptor('images', MAX_FILES_PER_UPLOAD, { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_FILES_PER_UPLOAD, fieldSize: 64 * 1024 } });

const cols = (ar: boolean): ExportColumn[] => [
  { key: 'id', label: '#', value: (r) => r.id },
  { key: 'titleAr', label: ar ? 'العنوان بالعربية' : 'Arabic title', value: (r) => r.titleAr },
  { key: 'titleEn', label: ar ? 'العنوان بالإنجليزية' : 'English title', value: (r) => r.titleEn },
  { key: 'eventDate', label: ar ? 'التاريخ' : 'Date', value: (r) => r.eventDate },
  { key: 'imageCount', label: ar ? 'عدد الصور' : 'Images', value: (r) => r.imageCount },
];

@Controller('admin/occasions')
export class OccasionsAdminController {
  constructor(
    private readonly service: OccasionsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Permissions(PERM.OCCASIONS_READ)
  list(@Query() q: OccasionsAdminQueryDto) {
    return this.service.list(q, 'all');
  }

  @Get('export')
  @Permissions(PERM.OCCASIONS_READ)
  async export(@Query() q: OccasionsAdminQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const ar = ex.lang !== 'en';
    const picked = pickColumns(cols(ar), ex.columns);
    const all = await this.service.list({ ...q, limit: 'all' }, 'all');
    await this.audit.logExport(u, { category: 'occasions', entityType: 'occasions', format: ex.format, rowCount: all.data.length, columns: picked.map((c) => c.key) });
    return sendExport(res, ex.format, 'occasions', picked, all.data, ar);
  }

  @Post()
  @Permissions(PERM.OCCASIONS_CREATE)
  @UseInterceptors(upload())
  create(@Body() dto: CreateOccasionDto, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() u: AuthUser) {
    return this.service.create(dto, files, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.OCCASIONS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.OCCASIONS_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOccasionDto, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, files, u);
  }

  @Delete(':id')
  @Permissions(PERM.OCCASIONS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

@Controller('public/occasions')
export class OccasionsPublicController {
  constructor(private readonly service: OccasionsService) {}

  @Public()
  @Get()
  list(@Query() q: PublicOccasionsQueryDto) {
    return this.service.publicList(q);
  }

  @Public()
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
    return this.service.publicOne(id, lang === 'en' ? 'en' : 'ar');
  }
}
