import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { AuditService } from '../audit/audit.service';
import { BulkDeleteDto } from '../news/news.dto';
import { CoursesAdminQueryDto, CreateCourseDto, CreateTrainerDto, PublicCoursesQueryDto, RegisterDto, RegistrationsAdminQueryDto, TrainersAdminQueryDto, UpdateCourseDto, UpdateTrainerDto } from './training.dto';
import { TrainersService } from './trainers.service';
import { TrainingService } from './training.service';

/** one picture in the multipart field "image" */
const upload = () => FileInterceptor('image', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fieldSize: 2 * 1024 * 1024 } });

@Controller('admin/courses')
export class CoursesAdminController {
  constructor(private readonly service: TrainingService) {}

  @Get()
  @Permissions(PERM.COURSES_READ)
  list(@Query() q: CoursesAdminQueryDto) {
    return this.service.list(q);
  }

  @Post()
  @Permissions(PERM.COURSES_CREATE)
  @UseInterceptors(upload())
  create(@Body() dto: CreateCourseDto, @UploadedFile() image: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, image, u);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.COURSES_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.COURSES_UPDATE)
  @UseInterceptors(upload())
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCourseDto, @UploadedFile() image: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, image, u);
  }

  @Delete(':id')
  @Permissions(PERM.COURSES_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

@Controller('admin/trainers')
export class TrainersAdminController {
  constructor(private readonly service: TrainersService) {}

  @Get()
  @Permissions(PERM.COURSES_READ)
  list(@Query() q: TrainersAdminQueryDto) {
    return this.service.list(q);
  }

  /** the course form's trainer picker */
  @Get('options')
  @Permissions(PERM.COURSES_READ)
  options() {
    return this.service.options();
  }

  @Post()
  @Permissions(PERM.COURSES_CREATE)
  create(@Body() dto: CreateTrainerDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.COURSES_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.COURSES_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTrainerDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Delete(':id')
  @Permissions(PERM.COURSES_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}

const cols = (ar: boolean): ExportColumn[] => [
  { key: 'id', label: '#', value: (r) => r.id },
  { key: 'courseName', label: ar ? 'الدورة' : 'Course', value: (r) => r.courseName },
  { key: 'name', label: ar ? 'الاسم' : 'Name', value: (r) => r.name },
  { key: 'email', label: ar ? 'البريد الإلكتروني' : 'E-mail', value: (r) => r.email },
  { key: 'phone', label: ar ? 'الهاتف' : 'Phone', value: (r) => r.phone },
  { key: 'organization', label: ar ? 'الجهة' : 'Organization', value: (r) => r.organization },
  { key: 'createdAt', label: ar ? 'تاريخ التسجيل' : 'Registered at', value: (r) => r.createdAt },
];

@Controller('admin/course-registrations')
export class RegistrationsAdminController {
  constructor(
    private readonly service: TrainingService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Permissions(PERM.REGISTRATIONS_READ)
  list(@Query() q: RegistrationsAdminQueryDto) {
    return this.service.listRegistrations(q);
  }

  /** the course filter of the registrations screen */
  @Get('courses')
  @Permissions(PERM.REGISTRATIONS_READ)
  courses() {
    return this.service.options();
  }

  @Get('export')
  @Permissions(PERM.REGISTRATIONS_EXPORT)
  async export(@Query() q: RegistrationsAdminQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const ar = ex.lang !== 'en';
    const picked = pickColumns(cols(ar), ex.columns);
    const rows = await this.service.allRegistrations(q);
    await this.audit.logExport(u, { category: 'training', entityType: 'course_registrations', format: ex.format, rowCount: rows.length, columns: picked.map((c) => c.key) });
    return sendExport(res, ex.format, 'course-registrations', picked, rows, ar);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.REGISTRATIONS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.removeRegistrations(dto.ids, u);
  }

  @Delete(':id')
  @Permissions(PERM.REGISTRATIONS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removeRegistrations([id], u);
  }
}

@Controller('public/training')
export class TrainingPublicController {
  constructor(private readonly service: TrainingService) {}

  @Public()
  @Get('courses')
  list(@Query() q: PublicCoursesQueryDto) {
    return this.service.publicList(q);
  }

  @Public()
  @Get('filters')
  filters(@Query('lang') lang?: string) {
    return this.service.publicFilters(lang === 'en' ? 'en' : 'ar');
  }

  @Public()
  @Get('courses/:id')
  one(@Param('id', ParseIntPipe) id: number, @Query('lang') lang?: string) {
    return this.service.publicOne(id, lang === 'en' ? 'en' : 'ar');
  }

  // 5 registrations / minute / IP, like the contact form
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('courses/:id/register')
  @HttpCode(200)
  register(@Param('id', ParseIntPipe) id: number, @Body() dto: RegisterDto) {
    return this.service.register(id, dto);
  }
}
