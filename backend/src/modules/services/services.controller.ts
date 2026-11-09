import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_PDF_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BulkDeleteDto } from '../news/news.dto';
import { CreateServiceDto, PublicServicesQueryDto, ServicesAdminQueryDto, UpdateServiceDto } from './services.dto';
import { ServicesService } from './services.service';

/** a picture in the multipart field "image" and a downloadable form in "form" */
const upload = () => FileFieldsInterceptor([{ name: 'image', maxCount: 1 }, { name: 'form', maxCount: 1 }], { storage: memoryStorage(), limits: { fileSize: MAX_PDF_BYTES, files: 2, fieldSize: 2 * 1024 * 1024 } });
export type ServiceFiles = { image?: Express.Multer.File[]; form?: Express.Multer.File[] };

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
  create(@Body() dto: CreateServiceDto, @UploadedFiles() files: ServiceFiles, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, files, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.SERVICES_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.SERVICES_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceDto, @UploadedFiles() files: ServiceFiles, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, files, u);
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
