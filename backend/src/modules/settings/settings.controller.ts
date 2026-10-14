import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { SettingsListQueryDto, UpdateSettingDto } from './settings.dto';
import { SettingsService } from './settings.service';

@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @Permissions(PERM.SETTINGS_READ)
  list(@Query() q: SettingsListQueryDto) {
    return this.service.list(q);
  }

  @Get('categories')
  @Permissions(PERM.SETTINGS_READ)
  categories() {
    return this.service.categories();
  }

  @Patch(':id')
  @Permissions(PERM.SETTINGS_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSettingDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto.value, u);
  }

  @Post(':id/file')
  @Permissions(PERM.SETTINGS_UPDATE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  upload(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @CurrentUser() u: AuthUser) {
    return this.service.uploadFile(id, file, u);
  }
}
