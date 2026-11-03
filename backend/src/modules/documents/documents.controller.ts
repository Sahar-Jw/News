import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_PDF_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { BulkDeleteDto } from '../news/news.dto';
import { CreateDocumentDto, DocumentsAdminQueryDto, PublicDocumentsQueryDto, UpdateDocumentDto } from './documents.dto';
import { DocumentsService } from './documents.service';

/** one PDF in the multipart field "file" */
const upload = () => FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_PDF_BYTES, files: 1, fieldSize: 2 * 1024 * 1024 } });

@Controller('admin/documents')
export class DocumentsAdminController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @Permissions(PERM.DOCUMENTS_READ)
  list(@Query() q: DocumentsAdminQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @Permissions(PERM.DOCUMENTS_CREATE)
  @UseInterceptors(upload())
  create(@Body() dto: CreateDocumentDto, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, file, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.DOCUMENTS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.DOCUMENTS_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDocumentDto, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, file, u);
  }

  @Delete(':id')
  @Permissions(PERM.DOCUMENTS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

@Controller('public/documents')
export class DocumentsPublicController {
  constructor(private readonly service: DocumentsService) {}

  @Public()
  @Get()
  list(@Query() q: PublicDocumentsQueryDto) {
    return this.service.publicList(q);
  }

  @Public()
  @Get('issuers')
  issuers(@Query('lang') lang?: string, @Query('kind') kind?: string, @Query('scope') scope?: string) {
    return this.service.publicIssuers(lang === 'en' ? 'en' : 'ar', kind, scope === 'official' ? 'official' : undefined);
  }

  @Public()
  @Get(':id')
  one(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
    return this.service.publicOne(id, lang === 'en' ? 'en' : 'ar');
  }
}
