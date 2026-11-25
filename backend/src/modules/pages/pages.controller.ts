import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { uploadLimits } from '../../common/upload-limits';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { PagesAdminQueryDto, UpdatePageDto } from './pages.dto';
import { PagesService } from './pages.service';

/** one picture in the multipart field "photo" (a plain JSON body still works) */
const upload = () => FileInterceptor('photo', { storage: memoryStorage(), defParamCharset: 'utf8', limits: { get fileSize() { return uploadLimits.imageBytes; }, files: 1, fieldSize: 2 * 1024 * 1024 } });

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
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePageDto, @UploadedFile() photo: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, photo, u);
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
