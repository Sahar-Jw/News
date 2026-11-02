import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BulkDeleteDto } from '../news/news.dto';
import { CreateServiceDto, PublicServicesQueryDto, ServicesAdminQueryDto, UpdateServiceDto } from './services.dto';
import { ServicesService } from './services.service';

/** one picture in the multipart field "image" */
const upload = () => FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fieldSize: 2 * 1024 * 1024 } });

@Controller('admin/services')
export class ServicesAdminController {
  constructor(private readonly service: ServicesService) {}

  @Get()
  @Permissions(PERM.SERVICES_READ)
  list(@Query() q: ServicesAdminQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @Permissions(PERM.SERVICES_CREATE)
  @UseInterceptors(upload())
  create(@Body() dto: CreateServiceDto, @UploadedFile() image: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, image, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.SERVICES_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.SERVICES_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceDto, @UploadedFile() image: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, image, u);
  }

  @Delete(':id')
  @Permissions(PERM.SERVICES_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

@Controller('public/services')
export class ServicesPublicController {
  constructor(private readonly service: ServicesService) {}

  @Public()
  @Get()
  list(@Query() q: PublicServicesQueryDto) {
    return this.service.publicList(q);
  }

  @Public()
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
    return this.service.publicOne(id, lang === 'en' ? 'en' : 'ar');
  }
}
