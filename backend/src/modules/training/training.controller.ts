import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { MAX_DOC_BYTES, MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { AuditService } from '../audit/audit.service';
import { BulkDeleteDto } from '../news/news.dto';
import { CoursesAdminQueryDto, CreateCourseDto, CreateTrainerDto, PublicCourseFiltersQueryDto, PublicCoursesQueryDto, RegisterDto, RegistrationsAdminQueryDto, TrainerApplicationsAdminQueryDto, TrainerApplyDto, TrainersAdminQueryDto, UpdateCourseDto, UpdateTrainerApplicationDto, UpdateTrainerDto } from './training.dto';
import { TrainerApplicationsService, MAX_CERTIFICATES } from './trainer-applications.service';
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
  { key: 'workplace', label: ar ? 'مكان العمل' : 'Workplace', value: (r) => r.workplace },
  { key: 'organization', label: ar ? 'اسم الشركة' : 'Company', value: (r) => r.organization },
  { key: 'jobTitle', label: ar ? 'المسمى الوظيفي' : 'Job title', value: (r) => r.jobTitle },
  { key: 'qualification', label: ar ? 'المؤهل العلمي' : 'Qualification', value: (r) => r.qualification },
  { key: 'experience', label: ar ? 'الخبرات / الاختصاص' : 'Experience / specialisation', value: (r) => r.experience },
  { key: 'notes', label: ar ? 'ملاحظات' : 'Notes', value: (r) => r.notes },
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

const trainerCols = (ar: boolean): ExportColumn[] => [
  { key: 'reference', label: ar ? 'رقم الطلب' : 'Reference', value: (r) => r.reference },
  { key: 'fullName', label: ar ? 'الاسم الثلاثي' : 'Full name', value: (r) => r.fullName },
  { key: 'phone', label: ar ? 'الهاتف' : 'Phone', value: (r) => r.phone },
  { key: 'email', label: ar ? 'البريد الإلكتروني' : 'E-mail', value: (r) => r.email },
  { key: 'specializations', label: ar ? 'الاختصاصات' : 'Specialisations', value: (r) => r.specializations },
  { key: 'trainingFields', label: ar ? 'مجالات التدريب' : 'Training fields', value: (r) => r.trainingFields },
  { key: 'qualification', label: ar ? 'المؤهل العلمي' : 'Qualification', value: (r) => r.qualification },
  { key: 'experience', label: ar ? 'الخبرات العلمية والتدريبية' : 'Scientific and training experience', value: (r) => r.experience },
  { key: 'programs', label: ar ? 'الدورات والبرامج' : 'Courses and programmes', value: (r) => r.programs },
  { key: 'bio', label: ar ? 'نبذة تعريفية' : 'Bio', value: (r) => r.bio },
  { key: 'certificateCount', label: ar ? 'عدد الشهادات' : 'Certificates', value: (r) => r.certificateCount },
  { key: 'status', label: ar ? 'الحالة' : 'Status', value: (r) => r.status },
  { key: 'createdAt', label: ar ? 'تاريخ الطلب' : 'Submitted at', value: (r) => r.createdAt },
];

/** Requests to become a trainer (same permissions as the course registrations: both are the trainees / applicants side of the center). */
@Controller('admin/trainer-applications')
export class TrainerApplicationsAdminController {
  constructor(
    private readonly service: TrainerApplicationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Permissions(PERM.REGISTRATIONS_READ)
  list(@Query() q: TrainerApplicationsAdminQueryDto) {
    return this.service.list(q);
  }

  @Get('export')
  @Permissions(PERM.REGISTRATIONS_EXPORT)
  async export(@Query() q: TrainerApplicationsAdminQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response, @CurrentUser() u: AuthUser) {
    const ar = ex.lang !== 'en';
    const picked = pickColumns(trainerCols(ar), ex.columns);
    const rows = await this.service.listAll(q);
    await this.audit.logExport(u, { category: 'training', entityType: 'trainer_applications', format: ex.format, rowCount: rows.length, columns: picked.map((c) => c.key) });
    return sendExport(res, ex.format, 'trainer-applications', picked, rows, ar);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.REGISTRATIONS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Get(':id')
  @Permissions(PERM.REGISTRATIONS_READ)
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.one(id);
  }

  @Patch(':id')
  @Permissions(PERM.COURSES_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTrainerApplicationDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Delete(':id')
  @Permissions(PERM.REGISTRATIONS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove([id], u);
  }
}

@Controller('public/training')
export class TrainingPublicController {
  constructor(
    private readonly service: TrainingService,
    private readonly trainerApplications: TrainerApplicationsService,
  ) {}

  @Public()
  @Get('courses')
  list(@Query() q: PublicCoursesQueryDto) {
    return this.service.publicList(q);
  }

  @Public()
  @Get('filters')
  filters(@Query() q: PublicCourseFiltersQueryDto) {
    return this.service.publicFilters(q.lang === 'en' ? 'en' : 'ar', (q.scope as 'archive' | 'current' | 'all') ?? 'archive');
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

  // 3 applications / 10 minutes / IP: a real applicant sends one. Files: "cv" (1, required) and "certificates" (optional).
  @Public()
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @Post('trainer-applications')
  @HttpCode(200)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'cv', maxCount: 1 }, { name: 'certificates', maxCount: MAX_CERTIFICATES }], { storage: memoryStorage(), limits: { fileSize: MAX_DOC_BYTES, files: 1 + MAX_CERTIFICATES, fieldSize: 1024 * 1024 } }))
  applyAsTrainer(@Body() dto: TrainerApplyDto, @UploadedFiles() files: { cv?: Express.Multer.File[]; certificates?: Express.Multer.File[] } | undefined) {
    return this.trainerApplications.apply(dto, files?.cv?.[0], files?.certificates ?? []);
  }
}
