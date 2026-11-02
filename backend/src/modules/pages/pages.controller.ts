import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BulkDeleteDto } from '../news/news.dto';
import { CreatePageDto, PagesAdminQueryDto, UpdatePageDto } from './pages.dto';
import { PagesService } from './pages.service';

@Controller('admin/pages')
export class PagesAdminController {
  constructor(private readonly service: PagesService) {}

  @Get()
  @Permissions(PERM.PAGES_READ)
  list(@Query() q: PagesAdminQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @Permissions(PERM.PAGES_CREATE)
  create(@Body() dto: CreatePageDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.PAGES_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.PAGES_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePageDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Delete(':id')
  @Permissions(PERM.PAGES_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

@Controller('public/pages')
export class PagesPublicController {
  constructor(private readonly service: PagesService) {}

  @Public()
  @Get()
  list(@Query('lang') lang?: string, @Query('footer') footer?: string) {
    return this.service.publicList(lang === 'en' ? 'en' : 'ar', footer === 'true');
  }

  @Public()
  @Get(':slug')
  one(@Param('slug') slug: string, @Query('lang') lang?: string) {
    return this.service.publicOne(slug, lang === 'en' ? 'en' : 'ar');
  }
}
