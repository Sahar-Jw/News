import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { PagesAdminQueryDto, UpdatePageDto } from './pages.dto';
import { PagesService } from './pages.service';

@Controller('admin/pages')
export class PagesAdminController {
  constructor(private readonly service: PagesService) {}

  @Get()
  @Permissions(PERM.PAGES_READ)
  list(@Query() q: PagesAdminQueryDto) {
    return this.service.list(q);
  }

  @Patch(':id')
  @Permissions(PERM.PAGES_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePageDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
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
