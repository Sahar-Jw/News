import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged, publicPage } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { MailService } from '../mail/mail.service';
import { SiteSetting } from '../settings/site-setting.entity';
import { Course, CourseKind } from './course.entity';
import { CourseRegistration } from './course-registration.entity';
import { CoursesAdminQueryDto, CreateCourseDto, PublicCoursesQueryDto, RegisterDto, RegistrationsAdminQueryDto, UpdateCourseDto } from './training.dto';

/** The chamber works in Damascus time: "today" decides current vs archive and whether registration is still possible. */
const TZ = process.env.APP_TIMEZONE || 'Asia/Damascus';
export const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

export type RegistrationStatus = 'open' | 'full' | 'closed' | 'ended';

/** open = can register; full = capacity reached; closed = closed by hand or already started; ended = finished (archive). */
export function registrationStatus(c: Pick<Course, 'startDate' | 'endDate' | 'registrationClosed' | 'capacity'>, registered: number, today = todayStr()): RegistrationStatus {
  const last = c.endDate ?? c.startDate;
  if (last < today) return 'ended';
  if (c.registrationClosed || c.startDate < today) return 'closed';
  if (c.capacity != null && registered >= c.capacity) return 'full';
  return 'open';
}

const TEXT_FIELDS = ['nameEn', 'fieldAr', 'fieldEn', 'topicsAr', 'topicsEn', 'audienceAr', 'audienceEn', 'locationAr', 'locationEn', 'feeAr', 'feeEn'] as const;
const lines = (v: string | null | undefined) => (v ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(CourseRegistration) private readonly regs: Repository<CourseRegistration>,
    @InjectRepository(SiteSetting) private readonly settings: Repository<SiteSetting>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    private readonly mail: MailService,
  ) {}

  private async counts(ids: (number | string)[]): Promise<Map<number, number>> {
    const out = new Map<number, number>();
    if (!ids.length) return out;
    const rows: { course_id: string; n: string }[] = await this.regs.createQueryBuilder('r').select('r.course_id', 'course_id').addSelect('COUNT(*)', 'n').where('r.course_id IN (:...ids)', { ids }).groupBy('r.course_id').getRawMany();
    rows.forEach((r) => out.set(Number(r.course_id), Number(r.n)));
    return out;
  }

  // ---------------------------------------------------------------- admin
  private presentAdmin(c: Course, registered: number) {
    const out: Record<string, unknown> = {
      id: c.id, kind: c.kind, nameAr: c.nameAr, trainerId: c.trainerId != null ? Number(c.trainerId) : null, trainerName: c.trainer?.nameAr ?? '',
      startDate: c.startDate, endDate: c.endDate ?? '', hours: c.hours, capacity: c.capacity, registrationClosed: c.registrationClosed,
      isActive: c.isActive, registered, status: registrationStatus(c, registered), imageUrl: this.storage.url(c.image), createdAt: c.createdAt, updatedAt: c.updatedAt,
    };
    for (const f of TEXT_FIELDS) out[f] = c[f] ?? '';
    return out;
  }

  async list(q: CoursesAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.courses.createQueryBuilder('c').leftJoinAndSelect('c.trainer', 't');
    if (q.kind) qb.andWhere('c.kind = :kind', { kind: q.kind });
    if (q.scope === 'current') qb.andWhere('COALESCE(c.endDate, c.startDate) >= :today', { today: todayStr() });
    if (q.scope === 'archive') qb.andWhere('COALESCE(c.endDate, c.startDate) < :today', { today: todayStr() });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('c.nameAr ILIKE :like', { like }).orWhere('c.nameEn ILIKE :like', { like }).orWhere('c.fieldAr ILIKE :like', { like }).orWhere('t.nameAr ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { nameAr: 'c.nameAr', nameEn: 'c.nameEn', fieldAr: 'c.fieldAr', trainerName: 't.nameAr', startDate: 'CAST(c.startDate AS TEXT)' });
    qb.orderBy('c.startDate', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('c.id', 'DESC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    const n = await this.counts(rows.map((r) => r.id));
    return paged(rows.map((r) => this.presentAdmin(r, n.get(Number(r.id)) ?? 0)), total, p);
  }

  /** lists for the course picker in the registrations screen */
  async options() {
    const rows = await this.courses.find({ select: { id: true, nameAr: true, startDate: true }, order: { startDate: 'DESC', id: 'DESC' }, take: 500 });
    return rows.map((r) => ({ id: Number(r.id), name: `${r.nameAr} (${r.startDate})` }));
  }

  private async checkTrainer(id: number | null | undefined) {
    if (id == null) return;
    const ok = await this.ds.query(`SELECT 1 FROM "trainers" WHERE "id" = $1`, [id]);
    if (!ok.length) throw new BadRequestException('المدرب غير موجود');
  }

  private apply(c: Course, dto: CreateCourseDto | UpdateCourseDto) {
    if (dto.kind !== undefined) c.kind = dto.kind as CourseKind;
    if (dto.nameAr !== undefined) c.nameAr = dto.nameAr.trim();
    for (const f of TEXT_FIELDS) {
      const v = (dto as Record<string, any>)[f];
      if (v !== undefined) c[f] = typeof v === 'string' ? v.trim() || null : null;
    }
    if (dto.trainerId !== undefined) c.trainerId = dto.trainerId ?? null;
    if (dto.startDate !== undefined) c.startDate = dto.startDate;
    if (dto.endDate !== undefined) c.endDate = dto.endDate ?? null;
    if (dto.hours !== undefined) c.hours = dto.hours ?? null;
    if (dto.capacity !== undefined) c.capacity = dto.capacity ?? null;
    if (dto.registrationClosed !== undefined) c.registrationClosed = dto.registrationClosed;
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    if (c.endDate && c.endDate < c.startDate) throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
  }

  async create(dto: CreateCourseDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    await this.checkTrainer(dto.trainerId);
    const path = image ? await this.storage.saveImage(image, 'courses', 1200) : null;
    try {
      const c = this.courses.create({ image: path, isActive: true, registrationClosed: false });
      this.apply(c, dto);
      const saved = await this.courses.save(c);
      await this.audit.log({ category: 'training', action: 'create', description: `إضافة دورة: ${saved.nameAr}`, actorId: actor.id, entityType: 'courses', entityId: saved.id });
      return this.presentAdmin(saved, 0);
    } catch (e) {
      await this.storage.remove(path); // nothing saved: do not leave an orphan file
      throw e;
    }
  }

  async update(id: number, dto: UpdateCourseDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const c = await this.courses.findOne({ where: { id } });
    if (!c) throw new NotFoundException('الدورة غير موجودة');
    if (dto.trainerId !== undefined) await this.checkTrainer(dto.trainerId);
    const newPath = image ? await this.storage.saveImage(image, 'courses', 1200) : null;
    const oldPath = c.image;
    try {
      this.apply(c, dto);
      if (newPath) c.image = newPath;
      else if (dto.removeImage) c.image = null;
      const saved = await this.courses.save(c);
      await this.audit.log({ category: 'training', action: 'update', description: `تعديل دورة: ${saved.nameAr}`, actorId: actor.id, entityType: 'courses', entityId: id });
      if (oldPath && oldPath !== saved.image) await this.storage.remove(oldPath);
      const n = await this.counts([id]);
      return this.presentAdmin(saved, n.get(Number(id)) ?? 0);
    } catch (e) {
      await this.storage.remove(newPath);
      throw e;
    }
  }

  remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.courses.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الدورات غير موجودة'); // nothing is deleted
    await this.courses.delete({ id: In(unique) }); // registrations go with it (ON DELETE CASCADE)
    await this.storage.removeMany(rows.map((r) => r.image));
    await this.audit.log({ category: 'training', action: 'delete', description: `حذف ${rows.length} دورة`, actorId: actor.id, entityType: 'courses', details: { ids: unique }, changes: removedChanges('courses', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- admin: registrations
  private regQuery(q: RegistrationsAdminQueryDto) {
    const qb = this.regs.createQueryBuilder('r').leftJoinAndSelect('r.course', 'c');
    if (q.courseId) qb.andWhere('r.courseId = :cid', { cid: q.courseId });
    if (q.from) qb.andWhere('r.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('r.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('r.name ILIKE :like', { like }).orWhere('r.email ILIKE :like', { like }).orWhere('r.phone ILIKE :like', { like }).orWhere('c.nameAr ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { courseName: 'c.nameAr', name: 'r.name', email: 'r.email', phone: 'r.phone', organization: 'r.organization', createdAt: 'CAST(r.createdAt AS TEXT)' });
    return qb.orderBy('r.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('r.id', 'DESC');
  }
  private presentReg(r: CourseRegistration) {
    return { id: r.id, courseId: Number(r.courseId), courseName: r.course?.nameAr ?? '', name: r.name, email: r.email, phone: r.phone, organization: r.organization ?? '', createdAt: r.createdAt };
  }
  async listRegistrations(q: RegistrationsAdminQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.regQuery(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.presentReg(r)), total, p);
  }
  async allRegistrations(q: RegistrationsAdminQueryDto) {
    return (await this.regQuery(q).take(10000).getMany()).map((r) => this.presentReg(r));
  }
  async removeRegistrations(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.regs.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض التسجيلات غير موجودة');
    await this.regs.delete({ id: In(unique) });
    // the participant's personal data is not copied into the audit log
    await this.audit.log({ category: 'training', action: 'delete', description: `حذف ${rows.length} تسجيل`, actorId: actor.id, entityType: 'course_registrations', details: { ids: unique }, changes: removedChanges('course_registrations', rows, ['name', 'email', 'phone', 'organization']) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public
  private card(c: Course, registered: number, en: boolean, today: string) {
    const pick = (ar: string | null, e: string | null) => (en && e) || ar || '';
    const t = c.trainer;
    return {
      id: Number(c.id), kind: c.kind, name: pick(c.nameAr, c.nameEn), field: pick(c.fieldAr, c.fieldEn), audience: pick(c.audienceAr, c.audienceEn),
      topics: lines(en && c.topicsEn ? c.topicsEn : c.topicsAr), trainer: t ? { id: Number(t.id), name: pick(t.nameAr, t.nameEn), bio: pick(t.bioAr, t.bioEn) } : null,
      startDate: c.startDate, endDate: c.endDate, hours: c.hours, location: pick(c.locationAr, c.locationEn), fee: pick(c.feeAr, c.feeEn),
      seatsLeft: c.capacity != null ? Math.max(0, c.capacity - registered) : null, status: registrationStatus(c, registered, today), imageUrl: this.storage.url(c.image),
    };
  }

  private publicBase(scope: 'current' | 'archive'): SelectQueryBuilder<Course> {
    const qb = this.courses.createQueryBuilder('c').leftJoinAndSelect('c.trainer', 't').where('c.isActive = true');
    qb.andWhere(scope === 'archive' ? 'COALESCE(c.endDate, c.startDate) < :today' : 'COALESCE(c.endDate, c.startDate) >= :today', { today: todayStr() });
    return qb;
  }

  async publicList(q: PublicCoursesQueryDto) {
    const scope = q.scope === 'archive' ? 'archive' : 'current';
    const p = publicPage(q, 12, 50);
    const qb = this.publicBase(scope);
    if (q.kind) qb.andWhere('c.kind = :kind', { kind: q.kind });
    if (q.trainerId) qb.andWhere('c.trainerId = :tid', { tid: q.trainerId });
    if (q.year) qb.andWhere('EXTRACT(YEAR FROM c.startDate) = :year', { year: q.year });
    if (q.field?.trim()) qb.andWhere('(c.fieldAr = :field OR c.fieldEn = :field)', { field: q.field.trim() });
    if (q.q?.trim()) {
      const like = `%${escapeLike(q.q.trim())}%`;
      qb.andWhere(new Brackets((b) => b.where('c.nameAr ILIKE :like', { like }).orWhere('c.nameEn ILIKE :like', { like }).orWhere('c.topicsAr ILIKE :like', { like }).orWhere('c.topicsEn ILIKE :like', { like })));
    }
    qb.orderBy('c.startDate', scope === 'archive' ? 'DESC' : 'ASC').addOrderBy('c.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    const n = await this.counts(rows.map((r) => r.id));
    const today = todayStr();
    const en = q.lang === 'en';
    return paged(rows.map((r) => this.card(r, n.get(Number(r.id)) ?? 0, en, today)), total, p);
  }

  /** Values for the archive search boxes (only what exists in archived courses). */
  async publicFilters(lang: string) {
    const en = lang === 'en';
    const rows = await this.publicBase('archive').select(['c.id', 'c.kind', 'c.fieldAr', 'c.fieldEn', 'c.startDate', 'c.trainerId', 't.id', 't.nameAr', 't.nameEn']).getMany();
    const years = [...new Set(rows.map((r) => Number(r.startDate.slice(0, 4))))].sort((a, b) => b - a);
    const fields = [...new Set(rows.map((r) => (en && r.fieldEn) || r.fieldAr).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, lang));
    const kinds = [...new Set(rows.map((r) => r.kind))];
    const tr = new Map<number, string>();
    rows.forEach((r) => r.trainer && tr.set(Number(r.trainer.id), (en && r.trainer.nameEn) || r.trainer.nameAr));
    const trainers = [...tr.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, lang));
    return { years, fields, kinds, trainers };
  }

  async publicOne(id: number, lang: string) {
    const c = await this.courses.findOne({ where: { id, isActive: true }, relations: { trainer: true } });
    if (!c) throw new NotFoundException('الدورة غير موجودة');
    const n = await this.counts([id]);
    return this.card(c, n.get(Number(id)) ?? 0, lang === 'en', todayStr());
  }

  async register(courseId: number, dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    let course!: Course;
    try {
      await this.ds.transaction(async (m) => {
        // the lock keeps two people from taking the last seat at the same moment
        const c = await m.findOne(Course, { where: { id: courseId, isActive: true }, lock: { mode: 'pessimistic_write' } });
        if (!c) throw new NotFoundException('الدورة غير موجودة');
        course = c;
        const registered = await m.count(CourseRegistration, { where: { courseId } });
        const st = registrationStatus(c, registered);
        if (st === 'full') throw new BadRequestException('اكتمل عدد المشاركين في هذه الدورة');
        if (st !== 'open') throw new BadRequestException('التسجيل في هذه الدورة مغلق');
        if (await m.exists(CourseRegistration, { where: { courseId, email } })) throw new ConflictException('هذا البريد الإلكتروني مسجّل في الدورة بالفعل');
        await m.save(m.create(CourseRegistration, { courseId, name: dto.name.trim(), email, phone: dto.phone.trim(), organization: dto.organization?.trim() || null }));
      });
    } catch (e: any) {
      if (e?.code === '23505') throw new ConflictException('هذا البريد الإلكتروني مسجّل في الدورة بالفعل');
      throw e;
    }
    // public form: no actor, and the participant's data stays in course_registrations, not in the log
    await this.audit.log({ category: 'training', action: 'create', description: `تسجيل جديد في دورة: ${course.nameAr}`, entityType: 'course_registrations', details: { courseId } });
    void this.notifyOfficer(course, dto, email);
    return { message: 'تم تسجيلك في الدورة بنجاح' };
  }

  /** E-mail to the training officer (setting training.officer_email, else the chamber's contact e-mail). Never fails the registration. */
  private async notifyOfficer(course: Course, dto: RegisterDto, email: string) {
    try {
      const get = async (category: string, key: string) => ((await this.settings.findOne({ where: { category, key } }))?.value ?? '').toString().trim();
      const to = (await get('training', 'officer_email')) || (await get('contact', 'email'));
      if (!to) return;
      const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h3>تسجيل جديد في دورة</h3><p><b>الدورة:</b> ${esc(course.nameAr)} (${esc(course.startDate)})</p><p><b>الاسم:</b> ${esc(dto.name.trim())}</p><p><b>البريد:</b> ${esc(email)}</p><p><b>الهاتف:</b> ${esc(dto.phone.trim())}</p>${dto.organization ? `<p><b>الجهة:</b> ${esc(dto.organization.trim())}</p>` : ''}</div>`;
      await this.mail.send(to, `تسجيل جديد: ${course.nameAr}`, html);
    } catch (e) {
      this.logger.error(`Could not notify the training officer: ${(e as Error).message}`);
    }
  }
}
