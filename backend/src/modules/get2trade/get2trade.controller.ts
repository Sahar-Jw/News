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
import { BookingDto, BookingsAdminQueryDto, CreatePackageDto, CreateSpaceDto, PackagesAdminQueryDto, SpacesAdminQueryDto, UpdateBookingDto, UpdateG2tSettingsDto, UpdatePackageDto, UpdateSpaceDto } from './get2trade.dto';
import { Get2TradeService } from './get2trade.service';

/** one picture in the multipart field "image" */
const upload = () => FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fieldSize: 2 * 1024 * 1024 } });

const cols = (ar: boolean): ExportColumn[] => [
  { key: 'reference', label: ar ? 'رقم الطلب' : 'Reference', value: (r) => r.reference },
  { key: 'kind', label: ar ? 'النوع' : 'Type', value: (r) => (r.kind === 'booking' ? (ar ? 'حجز' : 'Booking') : ar ? 'استفسار' : 'Inquiry') },
  { key: 'name', label: ar ? 'الاسم' : 'Name', value: (r) => r.name },
  { key: 'company', label: ar ? 'الشركة' : 'Company', value: (r) => r.company ?? '' },
  { key: 'phone', label: ar ? 'الهاتف' : 'Phone', value: (r) => r.phone },
  { key: 'email', label: ar ? 'البريد' : 'Email', value: (r) => r.email },
  { key: 'spaceName', label: ar ? 'المساحة' : 'Space', value: (r) => r.spaceName },
  { key: 'packageName', label: ar ? 'الباقة' : 'Package', value: (r) => r.packageName },
  { key: 'startDate', label: ar ? 'تاريخ البدء' : 'Start date', value: (r) => r.startDate ?? '' },
  { key: 'people', label: ar ? 'عدد الأشخاص' : 'People', value: (r) => r.people ?? '' },
  { key: 'status', label: ar ? 'الحالة' : 'Status', value: (r) => r.status },
  { key: 'createdAt', label: ar ? 'تاريخ الطلب' : 'Submitted at', value: (r) => r.createdAt },
];

@Controller('admin/get2trade')
export class Get2TradeAdminController {
  constructor(private readonly service: Get2TradeService, private readonly audit: AuditService) {}

  // ----- settings
  @Get('settings')
  @Permissions(PERM.GET2TRADE_READ)
  settings() {
    return this.service.getSettings();
  }

  @Patch('settings')
  @Permissions(PERM.GET2TRADE_UPDATE)
  updateSettings(@Body() dto: UpdateG2tSettingsDto, @CurrentUser() u: AuthUser) {
    return this.service.updateSettings(dto, u);
  }

  // ----- packages
  @Get('packages')
  @Permissions(PERM.GET2TRADE_READ)
  packages(@Query() q: PackagesAdminQueryDto) {
    return this.service.listPackages(q);
  }

  @Post('packages')
  @Permissions(PERM.GET2TRADE_CREATE)
  createPackage(@Body() dto: CreatePackageDto, @CurrentUser() u: AuthUser) {
    return this.service.createPackage(dto, u);
  }

  @Post('packages/bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.GET2TRADE_DELETE)
  bulkDeletePackages(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.removePackages(dto.ids, u);
  }

  @Patch('packages/:id')
  @Permissions(PERM.GET2TRADE_UPDATE)
  updatePackage(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePackageDto, @CurrentUser() u: AuthUser) {
    return this.service.updatePackage(id, dto, u);
  }

  @Delete('packages/:id')
  @Permissions(PERM.GET2TRADE_DELETE)
  removePackage(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removePackages([id], u);
  }

  // ----- spaces
  @Get('spaces')
  @Permissions(PERM.GET2TRADE_READ)
  spaces(@Query() q: SpacesAdminQueryDto) {
    return this.service.listSpaces(q);
  }

  @Post('spaces')
  @Permissions(PERM.GET2TRADE_CREATE)
  @UseInterceptors(upload())
  createSpace(@Body() dto: CreateSpaceDto, @UploadedFile() image: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.createSpace(dto, image, u);
  }

  @Post('spaces/bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.GET2TRADE_DELETE)
  bulkDeleteSpaces(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.removeSpaces(dto.ids, u);
  }

  @Patch('spaces/:id')
  @Permissions(PERM.GET2TRADE_UPDATE)
  @UseInterceptors(upload())
  updateSpace(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSpaceDto, @UploadedFile() image: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.updateSpace(id, dto, image, u);
  }

  @Delete('spaces/:id')
  @Permissions(PERM.GET2TRADE_DELETE)
  removeSpace(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removeSpaces([id], u);
  }

  // ----- bookings
  @Get('bookings')
  @Permissions(PERM.GET2TRADE_READ)
  bookings(@Query() q: BookingsAdminQueryDto) {
    return this.service.listBookings(q);
  }

  @Get('bookings/export')
  @Permissions(PERM.GET2TRADE_EXPORT)
  async export(@Query() q: BookingsAdminQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const ar = ex.lang !== 'en';
    const columns = pickColumns(cols(ar), ex.columns);
    const rows = await this.service.allBookings(q);
    await this.audit.logExport(u, { category: 'get2trade', entityType: 'g2t_bookings', format: ex.format, rowCount: rows.length, columns: columns.map((c) => c.key) });
    return sendExport(res, ex.format, 'get2trade-bookings', columns, rows, ar);
  }

  @Post('bookings/bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.GET2TRADE_DELETE)
  bulkDeleteBookings(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.removeBookings(dto.ids, u);
  }

  @Get('bookings/:id')
  @Permissions(PERM.GET2TRADE_READ)
  oneBooking(@Param('id', ParseIntPipe) id: number) {
    return this.service.oneBooking(id);
  }

  @Patch('bookings/:id')
  @Permissions(PERM.GET2TRADE_UPDATE)
  updateBooking(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookingDto, @CurrentUser() u: AuthUser) {
    return this.service.updateBooking(id, dto, u);
  }

  @Delete('bookings/:id')
  @Permissions(PERM.GET2TRADE_DELETE)
  removeBooking(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removeBookings([id], u);
  }
}

@Controller('public/get2trade')
export class Get2TradePublicController {
  constructor(private readonly service: Get2TradeService) {}

  @Public()
  @Get()
  page(@Query('lang') lang?: string) {
    return this.service.publicPage(lang === 'en' ? 'en' : 'ar');
  }

  // 3 requests / 10 minutes / IP: a real visitor sends one
  @Public()
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @Post('bookings')
  @HttpCode(200)
  book(@Body() dto: BookingDto) {
    return this.service.book(dto);
  }
}
