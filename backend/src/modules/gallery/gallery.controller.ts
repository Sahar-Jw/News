import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_FILES_PER_UPLOAD, MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { BulkDeleteDto } from '../news/news.dto';
import { CreateGalleryDto, PublicGalleryQueryDto, UpdateGalleryDto } from './gallery.dto';
import { GalleryService } from './gallery.service';

const upload = () => FilesInterceptor('images', MAX_FILES_PER_UPLOAD, { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_FILES_PER_UPLOAD, fieldSize: 64 * 1024 } });

@Controller('admin/gallery')
export class GalleryAdminController {
  constructor(private readonly service: GalleryService) {}

  @Get()
  @Permissions(PERM.GALLERY_READ)
  list(@Query() q: AdminListQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @Permissions(PERM.GALLERY_CREATE)
  @UseInterceptors(upload())
  create(@Body() dto: CreateGalleryDto, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() u: AuthUser) {
    return this.service.create(dto, files, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.GALLERY_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.GALLERY_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGalleryDto, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, files, u);
  }

  @Delete(':id')
  @Permissions(PERM.GALLERY_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove([id], u);
  }
}

@Controller('public/gallery')
export class GalleryPublicController {
  constructor(private readonly service: GalleryService) {}

  @Public()
  @Get()
  list(@Query() q: PublicGalleryQueryDto) {
    return this.service.publicList(q);
  }

  @Public()
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
    return this.service.publicOne(id, lang === 'en' ? 'en' : 'ar');
  }
}
