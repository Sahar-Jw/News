import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BulkDeleteDto } from '../news/news.dto';
import { BoardAdminQueryDto, CreateBoardMemberDto, UpdateBoardMemberDto } from './board.dto';
import { BoardService } from './board.service';

/** one picture in the multipart field "photo" */
const upload = () => FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fieldSize: 2 * 1024 * 1024 } });

@Controller('admin/board')
export class BoardAdminController {
  constructor(private readonly service: BoardService) {}

  @Get()
  @Permissions(PERM.BOARD_READ)
  list(@Query() q: BoardAdminQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @Permissions(PERM.BOARD_CREATE)
  @UseInterceptors(upload())
  create(@Body() dto: CreateBoardMemberDto, @UploadedFile() photo: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, photo, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.BOARD_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.BOARD_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBoardMemberDto, @UploadedFile() photo: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, photo, u);
  }

  @Delete(':id')
  @Permissions(PERM.BOARD_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

@Controller('public/board')
export class BoardPublicController {
  constructor(private readonly service: BoardService) {}

  @Public()
  @Get()
  list(@Query('lang') lang?: string) {
    return this.service.publicList(lang === 'en' ? 'en' : 'ar');
  }

  @Public()
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
    return this.service.publicOne(id, lang === 'en' ? 'en' : 'ar');
  }
}
