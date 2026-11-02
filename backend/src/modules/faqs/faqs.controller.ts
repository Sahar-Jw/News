import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BulkDeleteDto } from '../news/news.dto';
import { CreateFaqDto, FaqsAdminQueryDto, PublicFaqsQueryDto, UpdateFaqDto } from './faqs.dto';
import { FaqsService } from './faqs.service';

@Controller('admin/faqs')
export class FaqsAdminController {
  constructor(private readonly service: FaqsService) {}

  @Get()
  @Permissions(PERM.FAQS_READ)
  list(@Query() q: FaqsAdminQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @Permissions(PERM.FAQS_CREATE)
  create(@Body() dto: CreateFaqDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.FAQS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.FAQS_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFaqDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Delete(':id')
  @Permissions(PERM.FAQS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

@Controller('public/faqs')
export class FaqsPublicController {
  constructor(private readonly service: FaqsService) {}

  @Public()
  @Get()
  list(@Query() q: PublicFaqsQueryDto) {
    return this.service.publicList(q);
  }
}
