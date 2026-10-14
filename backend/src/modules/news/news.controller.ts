import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Req, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { MAX_FILES_PER_UPLOAD, MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthRequest, AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { BulkDeleteDto, CategoriesQueryDto, CreateNewsDto, LangQueryDto, NewsAdminQueryDto, PublicNewsQueryDto, SearchQueryDto, UpdateNewsDto } from './news.dto';
import { NewsPublicService } from './news-public.service';
import { NewsService } from './news.service';
import { SettingsService } from '../settings/settings.service';

const upload = () =>
  FilesInterceptor('images', MAX_FILES_PER_UPLOAD, {
    storage: memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_FILES_PER_UPLOAD, fieldSize: 2 * 1024 * 1024 },
  });

const cols = (ar: boolean): ExportColumn[] => [
  { key: 'id', label: '#', value: (r) => r.id },
  { key: 'title', label: ar ? 'العنوان' : 'Title', value: (r) => r.title },
  { key: 'subject', label: ar ? 'الموضوع' : 'Subject', value: (r) => r.subject },
  { key: 'mainCategory', label: ar ? 'الفئة الرئيسية' : 'Main category', value: (r) => r.mainCategory },
  { key: 'subcategory', label: ar ? 'الفئة الفرعية' : 'Subcategory', value: (r) => r.subcategory },
  { key: 'topics', label: ar ? 'المواضيع' : 'Topics', value: (r) => r.topics },
  { key: 'publishAt', label: ar ? 'تاريخ النشر' : 'Publish date', value: (r) => r.publishAt },
  { key: 'viewCount', label: ar ? 'المشاهدات' : 'Views', value: (r) => r.viewCount },
  { key: 'status', label: ar ? 'الحالة' : 'Status', value: (r) => r.status },
  { key: 'language', label: ar ? 'اللغة' : 'Language', value: (r) => r.language },
  { key: 'visibility', label: ar ? 'الظهور' : 'Visibility', value: (r) => r.visibility },
];

@Controller('admin/news')
export class NewsAdminController {
  constructor(private readonly service: NewsService) {}

  @Get()
  @Permissions(PERM.NEWS_READ)
  list(@Query() q: NewsAdminQueryDto) {
    return this.service.list(q);
  }

  @Get('categories')
  @Permissions(PERM.NEWS_READ)
  categories(@Query() q: CategoriesQueryDto) {
    return this.service.categories(q.mainCategory);
  }

  @Get('export')
  @Permissions(PERM.NEWS_READ)
  async export(@Query() q: NewsAdminQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response) {
    const ar = ex.lang !== 'en';
    const columns = pickColumns(cols(ar), ex.columns);
    return sendExport(res, ex.format, 'news', columns, await this.service.listAllForExport(q), ar);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.NEWS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.removeMany(dto.ids, u);
  }

  /** multipart/form-data (field "images", up to 20 files) or plain JSON. */
  @Post()
  @Permissions(PERM.NEWS_CREATE)
  @UseInterceptors(upload())
  create(@Body() dto: CreateNewsDto, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() u: AuthUser) {
    return this.service.create(dto, files, u);
  }

  @Get(':id')
  @Permissions(PERM.NEWS_READ)
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Patch(':id')
  @Permissions(PERM.NEWS_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNewsDto, @UploadedFiles() files: Express.Multer.File[], @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, files, u);
  }

  @Delete(':id')
  @Permissions(PERM.NEWS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removeMany([id], u);
  }
}

@Public()
@Controller('public')
export class NewsPublicController {
  constructor(
    private readonly service: NewsPublicService,
    private readonly settings: SettingsService,
  ) {}

  /** Lightweight site-wide settings (branding, contact, social, hero, section order, labels, pages). */
  @Get('settings')
  siteSettings() {
    return this.settings.publicMap();
  }

  private viewer(req: AuthRequest) {
    return { authenticated: !!req.user };
  }

  @Get('home')
  home(@Query() q: LangQueryDto, @Req() req: AuthRequest) {
    return this.service.home(q.lang, this.viewer(req));
  }

  @Get('news')
  list(@Query() q: PublicNewsQueryDto, @Req() req: AuthRequest) {
    return this.service.list(q, this.viewer(req));
  }

  @Get('news/:id')
  detail(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.service.detail(id, this.viewer(req), req.ip ?? '', String(req.headers['user-agent'] ?? ''));
  }

  @Get('categories')
  categories(@Query() q: LangQueryDto, @Req() req: AuthRequest) {
    return this.service.categories(q.lang, this.viewer(req));
  }

  @Get('search')
  search(@Query() q: SearchQueryDto, @Req() req: AuthRequest) {
    return this.service.search(q, this.viewer(req));
  }

  @Get('sections/:code')
  section(@Param('code') code: string, @Query() q: LangQueryDto, @Req() req: AuthRequest) {
    return this.service.section(code, q.lang, this.viewer(req));
  }
}
