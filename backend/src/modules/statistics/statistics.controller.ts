import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { newsPerm } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BulkDeleteDto } from '../news/news.dto';
import { CreateStatisticDto, PublicStatisticsQueryDto, StatisticsAdminQueryDto, UpdateStatisticDto } from './statistics.dto';
import { StatisticsService } from './statistics.service';

// the same permissions that already managed the "Statistics" section (news.read.statistics ...), so existing roles keep working
const READ = newsPerm('read', 'STATISTICS');
const CREATE = newsPerm('create', 'STATISTICS');
const UPDATE = newsPerm('update', 'STATISTICS');
const DELETE = newsPerm('delete', 'STATISTICS');

@Controller('admin/statistics')
export class StatisticsAdminController {
  constructor(private readonly service: StatisticsService) {}

  @Get()
  @Permissions(READ)
  list(@Query() q: StatisticsAdminQueryDto) {
    return this.service.list(q);
  }

  // DB-BACKED NUMBERS (disabled for now): the real numbers that can be chosen, each with its current value
  // @Get('metrics')
  // @Permissions(READ)
  // metrics() {
  //   return this.service.catalog();
  // }

  @Get(':id')
  @Permissions(READ)
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.adminOne(id);
  }

  @Post()
  @Permissions(CREATE)
  create(@Body() dto: CreateStatisticDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }

  @Post('bulk-delete')
  @Permissions(DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStatisticDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Delete(':id')
  @Permissions(DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

@Controller('public/statistics')
export class StatisticsPublicController {
  constructor(private readonly service: StatisticsService) {}

  @Public()
  @Get()
  list(@Query() q: PublicStatisticsQueryDto) {
    return this.service.publicList(q);
  }
}
