import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { BulkDeleteDto } from '../news/news.dto';
import { SetActiveDto, SubscribeDto, SubscribersQueryDto, TokenDto } from './subscribers.dto';
import { SubscribersService } from './subscribers.service';

const yn = (ar: boolean, v: boolean) => (v ? (ar ? 'نعم' : 'Yes') : ar ? 'لا' : 'No');
const cols = (ar: boolean): ExportColumn[] => [
  { key: 'id', label: '#', value: (r) => r.id },
  { key: 'email', label: ar ? 'البريد الإلكتروني' : 'E-mail', value: (r) => r.email },
  { key: 'isVerified', label: ar ? 'موثّق' : 'Verified', value: (r) => yn(ar, r.isVerified) },
  { key: 'isActive', label: ar ? 'نشط' : 'Active', value: (r) => yn(ar, r.isActive) },
  { key: 'verifiedAt', label: ar ? 'تاريخ التوثيق' : 'Verified at', value: (r) => r.verifiedAt },
  { key: 'rememberToken', label: ar ? 'رمز التذكر' : 'Remember token', value: (r) => r.rememberToken },
  { key: 'createdAt', label: ar ? 'تاريخ الاشتراك' : 'Subscribed at', value: (r) => r.createdAt },
];

@Controller()
export class SubscribersController {
  constructor(private readonly service: SubscribersService) {}

  // 5 requests / minute / IP, like the contact form
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('public/subscribe')
  @HttpCode(200)
  subscribe(@Body() dto: SubscribeDto) {
    return this.service.subscribe(dto.email, dto.lang === 'en' ? 'en' : 'ar');
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('public/subscribe/verify')
  @HttpCode(200)
  verify(@Body() dto: TokenDto) {
    return this.service.verify(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('public/subscribe/unsubscribe')
  @HttpCode(200)
  unsubscribe(@Body() dto: TokenDto) {
    return this.service.unsubscribe(dto.token);
  }

  @Get('admin/subscribers')
  @Permissions(PERM.SUBSCRIBERS_READ)
  list(@Query() q: SubscribersQueryDto) {
    return this.service.list(q);
  }

  @Get('admin/subscribers/export')
  @Permissions(PERM.SUBSCRIBERS_EXPORT)
  async export(@Query() q: SubscribersQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response) {
    const ar = ex.lang !== 'en';
    const picked = pickColumns(cols(ar), ex.columns);
    return sendExport(res, ex.format, 'subscribers', picked, await this.service.listAll(q), ar);
  }

  @Post('admin/subscribers/bulk-delete')
  @Permissions(PERM.SUBSCRIBERS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch('admin/subscribers/:id')
  @Permissions(PERM.SUBSCRIBERS_UPDATE)
  setActive(@Param('id', ParseIntPipe) id: number, @Body() dto: SetActiveDto, @CurrentUser() u: AuthUser) {
    return this.service.setActive(id, dto.isActive, u);
  }

  @Delete('admin/subscribers/:id')
  @Permissions(PERM.SUBSCRIBERS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove([id], u);
  }
}
