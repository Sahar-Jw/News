import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_FILES_PER_UPLOAD, MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BulkDeleteDto } from '../news/news.dto';
import { AdsAdminQueryDto, CreateAdDto, PublicAdsQueryDto, UpdateAdDto } from './ads.dto';
import { AdsService } from './ads.service';

const upload = () => FilesInterceptor('images', MAX_FILES_PER_UPLOAD, { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_FILES_PER_UPLOAD, fieldSize: 64 * 1024 } });

@Controller('admin/ads')
export class AdsAdminController {
  constructor(private readonly service: AdsService) {}

  @Get()
  @Permissions(PERM.ADS_READ)
  list(@Query() q: AdsAdminQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @Permissions(PERM.ADS_CREATE)
  @UseInterceptors(upload())
  create(@Body() dto: CreateAdDto, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() u: AuthUser) {
    return this.service.create(dto, files, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.ADS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.ADS_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdDto, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, files, u);
  }

  @Delete(':id')
  @Permissions(PERM.ADS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove([id], u);
  }
}

@Controller('public/ads')
export class AdsPublicController {
  constructor(private readonly service: AdsService) {}

  @Public()
  @Get()
  running(@Query() q: PublicAdsQueryDto) {
    return this.service.running(q);
  }
}
