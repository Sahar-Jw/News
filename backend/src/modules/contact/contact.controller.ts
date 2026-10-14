import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { CreateContactDto, MessageListQueryDto } from './contact.dto';
import { ContactService } from './contact.service';

const cols = (ar: boolean): ExportColumn[] => [
  { key: 'id', label: '#', value: (r) => r.id },
  { key: 'name', label: ar ? 'الاسم' : 'Name', value: (r) => r.name },
  { key: 'email', label: ar ? 'البريد' : 'Email', value: (r) => r.email },
  { key: 'subject', label: ar ? 'الموضوع' : 'Subject', value: (r) => r.subject },
  { key: 'message', label: ar ? 'الرسالة' : 'Message', value: (r) => r.message },
  { key: 'isRead', label: ar ? 'مقروءة' : 'Read', value: (r) => (r.isRead ? (ar ? 'نعم' : 'Yes') : ar ? 'لا' : 'No') },
  { key: 'createdAt', label: ar ? 'التاريخ' : 'Date', value: (r) => r.createdAt },
];

@Controller()
export class ContactController {
  constructor(private readonly service: ContactService) {}

  // 5 messages / minute / IP (SEC-NFR-007)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('public/contact')
  create(@Body() dto: CreateContactDto) {
    return this.service.create(dto);
  }

  @Get('admin/messages')
  @Permissions(PERM.MESSAGES_READ)
  list(@Query() q: MessageListQueryDto) {
    return this.service.list(q);
  }

  @Get('admin/messages/export')
  @Permissions(PERM.MESSAGES_READ)
  async export(@Query() q: MessageListQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response) {
    const ar = ex.lang !== 'en';
    const columns = pickColumns(cols(ar), ex.columns);
    return sendExport(res, ex.format, 'messages', columns, await this.service.listAll(q), ar);
  }

  @Get('admin/messages/:id')
  @HttpCode(200)
  @Permissions(PERM.MESSAGES_READ)
  open(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.open(id, u);
  }
}
