import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { MailService } from '../mail/mail.service';
import { SiteSetting } from '../settings/site-setting.entity';
import { TrainerApplicationsAdminQueryDto, TrainerApplyDto, UpdateTrainerApplicationDto } from './training.dto';
import { TrainerApplication, TrainerApplicationFile, TrainerApplicationStatus } from './trainer-application.entity';
import { officerTrainerApplication, trainerApplicationConfirmation } from './training-mail';

export const TRAINERS_FOLDER = 'private/trainers';
export const MAX_CERTIFICATES = 5;
/** "TR-2026-00042": shown to the applicant and used by the staff; derived from the id, nothing extra to store. */
export const trainerReference = (a: { id: number; createdAt: Date }) => `TR-${new Date(a.createdAt).getFullYear()}-${String(a.id).padStart(5, '0')}`;

/** Public "register as a trainer" form and its admin screen. The CV and the certificates are private files (need registrations.read). */
@Injectable()
export class TrainerApplicationsService {
  private readonly logger = new Logger(TrainerApplicationsService.name);

  constructor(
    @InjectRepository(TrainerApplication) private readonly apps: Repository<TrainerApplication>,
    @InjectRepository(SiteSetting) private readonly settings: Repository<SiteSetting>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    private readonly mail: MailService,
  ) {}

  /** The CV is a PDF / DOC / DOCX; a certificate may also be a picture. Content is checked, never the extension; everything goes to the private area. */
  private saveCv(f: Express.Multer.File) {
    return this.storage.saveDocument(f, TRAINERS_FOLDER);
  }
  private saveCertificate(f: Express.Multer.File) {
    return /^image\//.test(f.mimetype) ? this.storage.saveImage(f, TRAINERS_FOLDER, 1800) : this.storage.saveDocument(f, TRAINERS_FOLDER);
  }

  async apply(dto: TrainerApplyDto, cv: Express.Multer.File | undefined, certificates: Express.Multer.File[]) {
    const en = dto.lang === 'en';
    if (!cv) throw new BadRequestException(en ? 'Please attach your CV' : 'يرجى إرفاق السيرة الذاتية');
    if (certificates.length > MAX_CERTIFICATES) throw new BadRequestException(en ? `At most ${MAX_CERTIFICATES} certificates` : `الحد الأقصى ${MAX_CERTIFICATES} شهادات`);
    const email = dto.email.trim().toLowerCase();
    // one open application per e-mail: stops duplicates and flooding
    if (await this.apps.exists({ where: { email, status: In(['new', 'in_review']) } })) throw new ConflictException(en ? 'You already have an application under review with this e-mail' : 'لديك طلب قيد المعالجة بهذا البريد الإلكتروني');

    const saved: string[] = [];
    let cvPath: string;
    const certs: TrainerApplicationFile[] = [];
    try {
      cvPath = await this.saveCv(cv);
      saved.push(cvPath);
      for (const f of certificates) {
        const path = await this.saveCertificate(f);
        saved.push(path);
        certs.push({ name: (f.originalname || 'file').slice(0, 255), path, size: f.size });
      }
    } catch (e) {
      await this.storage.removeMany(saved); // nothing saved: do not leave orphan files
      throw e;
    }
    let app: TrainerApplication;
    try {
      app = await this.apps.save(this.apps.create({
        fullName: dto.fullName.trim(), phone: dto.phone.trim(), email, specializations: dto.specializations.trim(), trainingFields: dto.trainingFields.trim(), qualification: dto.qualification.trim(),
        experience: dto.experience.trim(), programs: dto.programs.trim(), bio: dto.bio.trim(), cvPath, cvName: (cv.originalname || 'cv').slice(0, 255), certificates: certs, status: 'new', staffNotes: null,
      }));
    } catch (e) {
      await this.storage.removeMany(saved);
      throw e;
    }
    const ref = trainerReference(app);
    // public form: no actor, and the applicant's data stays in trainer_applications, not in the log
    await this.audit.log({ category: 'training', action: 'create', description: `طلب تسجيل مدرب جديد ${ref}`, entityType: 'trainer_applications', entityId: app.id });
    void this.notify(app, ref, dto.lang === 'en' ? 'en' : 'ar');
    return { id: app.id, reference: ref, message: en ? 'Your application has been received. A confirmation e-mail has been sent to you.' : 'تم استلام طلبك. أرسلنا إليك رسالة تأكيد على بريدك الإلكتروني.' };
  }

  /** Confirmation to the applicant + notice to the training officer (setting training.officer_email, else the chamber's contact e-mail). Never fails the application. */
  private async notify(app: TrainerApplication, ref: string, lang: 'ar' | 'en') {
    try {
      const c = trainerApplicationConfirmation(lang, app.fullName, ref);
      await this.mail.send(app.email, c.subject, c.html);
      const get = async (category: string, key: string) => ((await this.settings.findOne({ where: { category, key } }))?.value ?? '').toString().trim();
      const to = (await get('training', 'officer_email')) || (await get('contact', 'email'));
      if (!to) return;
      const o = officerTrainerApplication(ref, { fullName: app.fullName, email: app.email, phone: app.phone, specializations: app.specializations, trainingFields: app.trainingFields, qualification: app.qualification, certificates: app.certificates.length });
      await this.mail.send(to, o.subject, o.html);
    } catch (e) {
      this.logger.error(`Could not send the trainer application e-mails: ${(e as Error).message}`);
    }
  }

  // ---------------------------------------------------------------- admin
  private present(a: TrainerApplication, withFiles = false) {
    const out: Record<string, unknown> = {
      id: a.id, reference: trainerReference(a), fullName: a.fullName, phone: a.phone, email: a.email, specializations: a.specializations, trainingFields: a.trainingFields,
      qualification: a.qualification, experience: a.experience, programs: a.programs, bio: a.bio, status: a.status, staffNotes: a.staffNotes ?? '', certificateCount: a.certificates.length, createdAt: a.createdAt, updatedAt: a.updatedAt,
    };
    if (withFiles) {
      out.cv = { name: a.cvName, url: this.storage.url(a.cvPath) };
      out.certificates = a.certificates.map((f) => ({ name: f.name, size: f.size, url: this.storage.url(f.path) }));
    }
    return out;
  }

  private query(q: TrainerApplicationsAdminQueryDto) {
    const qb = this.apps.createQueryBuilder('a');
    if (q.status) qb.andWhere('a.status = :st', { st: q.status });
    if (q.from) qb.andWhere('a.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('a.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('a.fullName ILIKE :like', { like }).orWhere('a.email ILIKE :like', { like }).orWhere('a.phone ILIKE :like', { like }).orWhere('a.specializations ILIKE :like', { like }).orWhere('a.trainingFields ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { fullName: 'a.fullName', email: 'a.email', phone: 'a.phone', specializations: 'a.specializations', trainingFields: 'a.trainingFields', qualification: 'a.qualification', createdAt: 'CAST(a.createdAt AS TEXT)' });
    return qb.orderBy('a.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('a.id', 'DESC');
  }

  async list(q: TrainerApplicationsAdminQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.query(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  async listAll(q: TrainerApplicationsAdminQueryDto) {
    return (await this.query(q).take(10000).getMany()).map((r) => this.present(r));
  }

  async one(id: number) {
    const a = await this.apps.findOne({ where: { id } });
    if (!a) throw new NotFoundException('الطلب غير موجود');
    return this.present(a, true);
  }

  async update(id: number, dto: UpdateTrainerApplicationDto, actor: AuthUser) {
    const a = await this.apps.findOne({ where: { id } });
    if (!a) throw new NotFoundException('الطلب غير موجود');
    if (dto.status !== undefined) a.status = dto.status as TrainerApplicationStatus;
    if (dto.staffNotes !== undefined) a.staffNotes = dto.staffNotes?.trim() || null;
    const saved = await this.apps.save(a);
    await this.audit.log({ category: 'training', action: 'update', description: `تحديث طلب المدرب ${trainerReference(saved)} (${saved.status})`, actorId: actor.id, entityType: 'trainer_applications', entityId: id });
    return this.present(saved, true);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.apps.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الطلبات غير موجودة'); // nothing is deleted
    await this.apps.delete({ id: In(unique) });
    await this.storage.removeMany(rows.flatMap((r) => [r.cvPath, ...r.certificates.map((f) => f.path)]));
    // the applicant's personal data is not copied into the audit log
    await this.audit.log({ category: 'training', action: 'delete', description: `حذف ${rows.length} من طلبات المدربين`, actorId: actor.id, entityType: 'trainer_applications', details: { ids: unique } });
    return { deleted: rows.length };
  }
}
