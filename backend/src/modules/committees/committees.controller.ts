import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BulkDeleteDto } from '../news/news.dto';
import { CommitteeAdminQueryDto, CreateActivityDto, CreateCommitteeDto, CreateMemberDto, LinkNewsDto, PublicCommitteesQueryDto, UpdateActivityDto, UpdateCommitteeDto, UpdateMemberDto } from './committees.dto';
import { CommitteesService } from './committees.service';

/** one picture in the multipart field named `field` */
const upload = (field: string) => FileInterceptor(field, { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fieldSize: 2 * 1024 * 1024 } });

@Controller('admin/committees')
export class CommitteesAdminController {
  constructor(private readonly service: CommitteesService) {}

  @Get()
  @Permissions(PERM.COMMITTEES_READ)
  list(@Query() q: CommitteeAdminQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @Permissions(PERM.COMMITTEES_CREATE)
  @UseInterceptors(upload('logo'))
  create(@Body() dto: CreateCommitteeDto, @UploadedFile() logo: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, logo, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.COMMITTEES_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  // members and activities are edited from the committee editor, so they need the "update" permission
  @Patch('members/:id')
  @Permissions(PERM.COMMITTEES_UPDATE)
  @UseInterceptors(upload('photo'))
  updateMember(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMemberDto, @UploadedFile() photo: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.updateMember(id, dto, photo, u);
  }

  @Delete('members/:id')
  @Permissions(PERM.COMMITTEES_UPDATE)
  removeMember(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removeMember(id, u);
  }

  @Patch('activities/:id')
  @Permissions(PERM.COMMITTEES_UPDATE)
  updateActivity(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActivityDto, @CurrentUser() u: AuthUser) {
    return this.service.updateActivity(id, dto, u);
  }

  @Delete('activities/:id')
  @Permissions(PERM.COMMITTEES_UPDATE)
  removeActivity(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removeActivity(id, u);
  }

  @Get(':id/full')
  @Permissions(PERM.COMMITTEES_READ)
  full(@Param('id', ParseIntPipe) id: number) {
    return this.service.full(id);
  }

  @Post(':id/members')
  @Permissions(PERM.COMMITTEES_UPDATE)
  @UseInterceptors(upload('photo'))
  addMember(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateMemberDto, @UploadedFile() photo: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.addMember(id, dto, photo, u);
  }

  @Post(':id/activities')
  @Permissions(PERM.COMMITTEES_UPDATE)
  addActivity(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateActivityDto, @CurrentUser() u: AuthUser) {
    return this.service.addActivity(id, dto, u);
  }

  @Get(':id/news-search')
  @Permissions(PERM.COMMITTEES_UPDATE)
  searchNews(@Param('id', ParseIntPipe) id: number, @Query('q') q?: string) {
    return this.service.searchNews(id, q ?? '');
  }

  @Post(':id/news')
  @Permissions(PERM.COMMITTEES_UPDATE)
  linkNews(@Param('id', ParseIntPipe) id: number, @Body() dto: LinkNewsDto, @CurrentUser() u: AuthUser) {
    return this.service.linkNews(id, dto.newsIds, u);
  }

  @Post(':id/news/unlink')
  @Permissions(PERM.COMMITTEES_UPDATE)
  unlinkNews(@Param('id', ParseIntPipe) id: number, @Body() dto: LinkNewsDto, @CurrentUser() u: AuthUser) {
    return this.service.unlinkNews(id, dto.newsIds, u);
  }

  @Patch(':id')
  @Permissions(PERM.COMMITTEES_UPDATE)
  @UseInterceptors(upload('logo'))
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCommitteeDto, @UploadedFile() logo: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, logo, u);
  }

  @Delete(':id')
  @Permissions(PERM.COMMITTEES_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

@Controller('public/committees')
export class CommitteesPublicController {
  constructor(private readonly service: CommitteesService) {}

  @Public()
  @Get()
  list(@Query() q: PublicCommitteesQueryDto) {
    return this.service.publicList(q.lang === 'en' ? 'en' : 'ar', q.q);
  }

  // declared before ":id" so "women" is not parsed as an id
  @Public()
  @Get('women')
  women(@Query('lang') lang?: string) {
    return this.service.publicWomen(lang === 'en' ? 'en' : 'ar');
  }

  @Public()
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
    return this.service.publicOne(id, lang === 'en' ? 'en' : 'ar');
  }
}
