import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { CC } from '../../common/content-categories';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged, publicPage } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { ContentStore, Rec, isActive, pick, s } from '../content/content.store';
import { by, filterByCf, matches, pageRows } from '../content/mem';
import { FileStorageService } from '../files/file-storage.service';
import { MailService } from '../mail/mail.service';
import { News } from '../news/news.entity';
import { SiteSetting } from '../settings/site-setting.entity';
import { CourseKind } from './course.entity';
import { CourseRegistration } from './course-registration.entity';
import { CoursesAdminQueryDto, CreateCourseDto, PublicCoursesQueryDto, RegisterDto, RegistrationsAdminQueryDto, UpdateCourseDto } from './training.dto';

/** The chamber works in Damascus time: "today" decides current vs archive and whether registration is still possible. */
const TZ = process.env.APP_TIMEZONE || 'Asia/Damascus';
export const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

export type RegistrationStatus = 'open' | 'full' | 'closed' | 'ended';

/** open = can register; full = capacity reached; closed = closed by hand or already started; ended = finished (archive). */
export function registrationStatus(c: { startDate: string; endDate: string | null; registrationClosed: boolean; capacity: number | null }, registered: number, today = todayStr()): RegistrationStatus {
  const last = c.endDate ?? c.startDate;
  if (last < today) return 'ended';
  if (c.registrationClosed || c.startDate < today) return 'closed';
  if (c.capacity != null && registered >= c.capacity) return 'full';
  return 'open';
}

/** course text fields kept in `extra` (the Arabic name is the news title) */
const X_TEXT_FIELDS = ['nameEn', 'fieldAr', 'fieldEn', 'topicsAr', 'topicsEn', 'audienceAr', 'audienceEn', 'locationAr', 'locationEn', 'feeAr', 'feeEn'] as const;
const lines = (v: string | null | undefined) => (v ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Training courses: news rows of the main category COURSE (name = news title, picture = news image); dates, trainer (the news id of a TRAINER row),
 * hours, capacity, fee, topics, order and visibility live in `extra`. Registrations stay in their own table and point to the course's news id.
 */
@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    private readonly store: ContentStore,
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

  /** a course as the old entity looked: `x` fields flattened, name = news title */
  private view(r: Rec) {
    const x = r.x;
    return {
      id: r.id, kind: (x.kind ?? 'course') as CourseKind, nameAr: r.title, nameEn: s(x.nameEn), fieldAr: s(x.fieldAr), fieldEn: s(x.fieldEn), topicsAr: s(x.topicsAr), topicsEn: s(x.topicsEn),
      audienceAr: s(x.audienceAr), audienceEn: s(x.audienceEn), locationAr: s(x.locationAr), locationEn: s(x.locationEn), feeAr: s(x.feeAr), feeEn: s(x.feeEn),
      trainerId: x.trainerId != null ? Number(x.trainerId) : null, startDate: String(x.startDate ?? ''), endDate: (x.endDate ?? null) as string | null, hours: (x.hours ?? null) as number | null,
      capacity: (x.capacity ?? null) as number | null, registrationClosed: x.registrationClosed === true, isActive: isActive(r), image: r.images[0] ?? null, createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }

  private async trainerMap() {
    return new Map((await this.store.list(CC.TRAINER)).map((t) => [t.id, t]));
  }

  // ---------------------------------------------------------------- admin
  private presentAdmin(c: ReturnType<TrainingService['view']>, registered: number, trainers: Map<number, Rec>) {
    const t = c.trainerId != null ? trainers.get(c.trainerId) : undefined;
    const out: Record<string, unknown> = {
      id: c.id, kind: c.kind, nameAr: c.nameAr, trainerId: c.trainerId, trainerName: t?.title ?? '',
      startDate: c.startDate, endDate: c.endDate ?? '', hours: c.hours, capacity: c.capacity, registrationClosed: c.registrationClosed,
      isActive: c.isActive, registered, status: registrationStatus(c, registered), imageUrl: this.storage.url(c.image), createdAt: c.createdAt, updatedAt: c.updatedAt,
    };
    for (const f of X_TEXT_FIELDS) out[f] = (c as Record<string, any>)[f] ?? '';
    return out;
  }

  async list(q: CoursesAdminQueryDto) {
    const trainers = await this.trainerMap();
    const today = todayStr();
    let rows = (await this.store.list(CC.COURSE)).map((r) => this.view(r));
    if (q.kind) rows = rows.filter((c) => c.kind === q.kind);
    if (q.scope === 'current') rows = rows.filter((c) => (c.endDate ?? c.startDate) >= today);
    if (q.scope === 'archive') rows = rows.filter((c) => (c.endDate ?? c.startDate) < today);
    const tname = (c: { trainerId: number | null }) => (c.trainerId != null ? trainers.get(c.trainerId)?.title ?? '' : '');
    if (q.q) rows = rows.filter((c) => matches([c.nameAr, c.nameEn, c.fieldAr, tname(c)], q.q!));
    rows = filterByCf(rows, q.cf, { nameAr: (c) => [c.nameAr], nameEn: (c) => [c.nameEn], fieldAr: (c) => [c.fieldAr], trainerName: (c) => [tname(c)], startDate: (c) => [c.startDate] });
    const asc = q.sortDir?.toUpperCase() === 'ASC';
    rows.sort((a, b) => (a.startDate === b.startDate ? b.id - a.id : (a.startDate < b.startDate ? -1 : 1) * (asc ? 1 : -1)));
    const n = await this.counts(rows.map((r) => r.id));
    return pageRows(rows, q, (c) => this.presentAdmin(c, n.get(c.id) ?? 0, trainers));
  }

  /** lists for the course picker in the registrations screen */
  async options() {
    return (await this.store.list(CC.COURSE)).map((r) => this.view(r)).sort((a, b) => (a.startDate === b.startDate ? b.id - a.id : a.startDate < b.startDate ? 1 : -1)).slice(0, 500).map((r) => ({ id: r.id, name: `${r.nameAr} (${r.startDate})` }));
  }

  private async checkTrainer(id: number | null | undefined) {
    if (id == null) return;
    if (!(await this.store.get(id, CC.TRAINER))) throw new BadRequestException('المدرب غير موجود');
  }

  private xOf(dto: CreateCourseDto | UpdateCourseDto) {
    const x: Record<string, any> = {
      kind: dto.kind, trainerId: dto.trainerId === undefined ? undefined : dto.trainerId ?? null, startDate: dto.startDate, endDate: dto.endDate === undefined ? undefined : dto.endDate ?? null,
      hours: dto.hours === undefined ? undefined : dto.hours ?? null, capacity: dto.capacity === undefined ? undefined : dto.capacity ?? null, registrationClosed: dto.registrationClosed, isActive: dto.isActive,
    };
    for (const f of X_TEXT_FIELDS) {
      const v = (dto as Record<string, any>)[f];
      if (v !== undefined) x[f] = typeof v === 'string' ? v.trim() || null : null;
    }
    return x;
  }

  async create(dto: CreateCourseDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    await this.checkTrainer(dto.trainerId);
    if (dto.endDate && dto.endDate < dto.startDate) throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
    const path = image ? await this.storage.saveImage(image, 'courses', 1200) : null;
    try {
      const x = this.xOf(dto);
      const r = await this.store.create(CC.COURSE, { title: dto.nameAr.trim(), images: path ? [path] : [], x: { ...x, kind: x.kind ?? 'course', registrationClosed: x.registrationClosed ?? false, isActive: x.isActive ?? true } });
      await this.audit.log({ category: 'training', action: 'create', description: `إضافة دورة: ${r.title}`, actorId: actor.id, entityType: 'courses', entityId: r.id });
      return this.presentAdmin(this.view(r), 0, await this.trainerMap());
    } catch (e) {
      await this.storage.remove(path); // nothing saved: do not leave an orphan file
      throw e;
    }
  }

  async update(id: number, dto: UpdateCourseDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const cur = await this.store.get(id, CC.COURSE);
    if (!cur) throw new NotFoundException('الدورة غير موجودة');
    if (dto.trainerId !== undefined) await this.checkTrainer(dto.trainerId);
    const start = dto.startDate ?? String(cur.x.startDate ?? '');
    const end = dto.endDate !== undefined ? dto.endDate : (cur.x.endDate ?? null);
    if (end && end < start) throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
    const newPath = image ? await this.storage.saveImage(image, 'courses', 1200) : null;
    const oldPath = cur.images[0] ?? null;
    try {
      const r = await this.store.update(id, { title: dto.nameAr?.trim(), images: newPath ? [newPath] : dto.removeImage ? [] : undefined, x: this.xOf(dto) });
      await this.audit.log({ category: 'training', action: 'update', description: `تعديل دورة: ${r!.title}`, actorId: actor.id, entityType: 'courses', entityId: id });
      if (oldPath && oldPath !== (r!.images[0] ?? null)) await this.storage.remove(oldPath);
      const n = await this.counts([id]);
      return this.presentAdmin(this.view(r!), n.get(id) ?? 0, await this.trainerMap());
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
    const all = await this.store.list(CC.COURSE);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض الدورات غير موجودة'); // nothing is deleted
    await this.store.remove(unique); // registrations go with it (ON DELETE CASCADE)
    await this.storage.removeMany(rows.map((r) => r.images[0] ?? null));
    await this.audit.log({ category: 'training', action: 'delete', description: `حذف ${rows.length} دورة`, actorId: actor.id, entityType: 'courses', details: { ids: unique }, changes: removedChanges('courses', rows.map((r) => this.view(r))) });
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
      qb.andWhere(new Brackets((b) => b.where('r.name ILIKE :like', { like }).orWhere('r.email ILIKE :like', { like }).orWhere('r.phone ILIKE :like', { like }).orWhere('c.title ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { courseName: 'c.title', name: 'r.name', email: 'r.email', phone: 'r.phone', organization: 'r.organization', createdAt: 'CAST(r.createdAt AS TEXT)' });
    return qb.orderBy('r.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('r.id', 'DESC');
  }
  private presentReg(r: CourseRegistration) {
    return { id: r.id, courseId: Number(r.courseId), courseName: r.course?.title ?? '', name: r.name, email: r.email, phone: r.phone, organization: r.organization ?? '', createdAt: r.createdAt };
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
  private card(c: ReturnType<TrainingService['view']>, registered: number, en: boolean, today: string, trainers: Map<number, Rec>) {
    const t = c.trainerId != null ? trainers.get(c.trainerId) : undefined;
    return {
      id: c.id, kind: c.kind, name: pick(c.nameAr, c.nameEn, en), field: pick(c.fieldAr, c.fieldEn, en), audience: pick(c.audienceAr, c.audienceEn, en),
      topics: lines(en && c.topicsEn ? c.topicsEn : c.topicsAr), trainer: t ? { id: t.id, name: pick(t.title, t.x.nameEn, en), bio: pick(t.body, t.x.bioEn, en) } : null,
      startDate: c.startDate, endDate: c.endDate, hours: c.hours, location: pick(c.locationAr, c.locationEn, en), fee: pick(c.feeAr, c.feeEn, en),
      seatsLeft: c.capacity != null ? Math.max(0, c.capacity - registered) : null, status: registrationStatus(c, registered, today), imageUrl: this.storage.url(c.image),
    };
  }

  private async publicBase(scope: 'current' | 'archive') {
    const today = todayStr();
    return (await this.store.list(CC.COURSE)).filter(isActive).map((r) => this.view(r)).filter((c) => (scope === 'archive' ? (c.endDate ?? c.startDate) < today : (c.endDate ?? c.startDate) >= today));
  }

  async publicList(q: PublicCoursesQueryDto) {
    const scope = q.scope === 'archive' ? 'archive' : 'current';
    const p = publicPage(q, 12, 50);
    let rows = await this.publicBase(scope);
    if (q.kind) rows = rows.filter((c) => c.kind === q.kind);
    if (q.trainerId) rows = rows.filter((c) => c.trainerId === Number(q.trainerId));
    if (q.year) rows = rows.filter((c) => Number(c.startDate.slice(0, 4)) === Number(q.year));
    if (q.field?.trim()) rows = rows.filter((c) => c.fieldAr === q.field!.trim() || c.fieldEn === q.field!.trim());
    if (q.q?.trim()) rows = rows.filter((c) => matches([c.nameAr, c.nameEn, c.topicsAr, c.topicsEn], q.q!));
    rows.sort((a, b) => (a.startDate === b.startDate ? a.id - b.id : (a.startDate < b.startDate ? -1 : 1) * (scope === 'archive' ? -1 : 1)));
    const page = rows.slice(p.skip, p.skip + p.limit);
    const n = await this.counts(page.map((r) => r.id));
    const today = todayStr();
    const en = q.lang === 'en';
    const trainers = await this.trainerMap();
    return paged(page.map((r) => this.card(r, n.get(r.id) ?? 0, en, today, trainers)), rows.length, p);
  }

  /** Values for the archive search boxes (only what exists in archived courses). */
  async publicFilters(lang: string) {
    const en = lang === 'en';
    const rows = await this.publicBase('archive');
    const trainers = await this.trainerMap();
    const years = [...new Set(rows.map((r) => Number(r.startDate.slice(0, 4))))].sort((a, b) => b - a);
    const fields = [...new Set(rows.map((r) => (en && r.fieldEn) || r.fieldAr).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, lang));
    const kinds = [...new Set(rows.map((r) => r.kind))];
    const tr = new Map<number, string>();
    rows.forEach((r) => {
      const t = r.trainerId != null ? trainers.get(r.trainerId) : undefined;
      if (t) tr.set(t.id, pick(t.title, t.x.nameEn, en));
    });
    const list = [...tr.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, lang));
    return { years, fields, kinds, trainers: list };
  }

  async publicOne(id: number, lang: string) {
    const r = await this.store.get(id, CC.COURSE);
    if (!r || !isActive(r)) throw new NotFoundException('الدورة غير موجودة');
    const n = await this.counts([id]);
    return this.card(this.view(r), n.get(id) ?? 0, lang === 'en', todayStr(), await this.trainerMap());
  }

  async register(courseId: number, dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    let course!: ReturnType<TrainingService['view']>;
    try {
      await this.ds.transaction(async (m) => {
        // the lock keeps two people from taking the last seat at the same moment
        const row = await m.findOne(News, { where: { id: courseId, mainCategory: CC.COURSE }, lock: { mode: 'pessimistic_write' } });
        if (!row || row.extra?.isActive === false) throw new NotFoundException('الدورة غير موجودة');
        const c = this.view({ id: Number(row.id), code: row.mainCategory, title: row.title, body: row.body ?? null, images: row.images ?? [], pdf: row.pdf ?? null, x: (row.extra ?? {}) as Record<string, any>, createdAt: row.createdAt, updatedAt: row.updatedAt });
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
  private async notifyOfficer(course: { nameAr: string; startDate: string }, dto: RegisterDto, email: string) {
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
