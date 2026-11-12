import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { SaveShortcutsDto, SaveHeroButtonsDto, SettingsListQueryDto, UpdateSettingDto } from './settings.dto';
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

  /** Home quick links: what is saved and the pages that can be chosen (both titles come with each page). */
  @Get('shortcuts')
  @Permissions(PERM.SETTINGS_READ)
  shortcuts() {
    return this.service.shortcuts();
  }

  @Put('shortcuts')
  @Permissions(PERM.SETTINGS_UPDATE)
  saveShortcuts(@Body() dto: SaveShortcutsDto, @CurrentUser() u: AuthUser) {
    return this.service.saveShortcuts(dto.urls, u);
  }

  /** The site's pages as a pick-list (menu pages and a few fixed ones) for any editor that needs to link to a page; any signed-in user. */
  @Get('page-options')
  pageOptions() {
    return this.service.pageOptions();
  }

  /** Home hero: the button of each slide (page from the page list + its text). */
  @Get('hero-buttons')
  @Permissions(PERM.SETTINGS_READ)
  heroButtons() {
    return this.service.heroButtons();
  }

  @Put('hero-buttons')
  @Permissions(PERM.SETTINGS_UPDATE)
  saveHeroButtons(@Body() dto: SaveHeroButtonsDto, @CurrentUser() u: AuthUser) {
    return this.service.saveHeroButtons(dto.items, u);
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
