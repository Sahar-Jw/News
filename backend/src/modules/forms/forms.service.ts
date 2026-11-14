import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, LessThan, Repository } from 'typeorm';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike, sanitizeRichText } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { MailService } from '../mail/mail.service';
import { ContactApplicantDto, SaveFormDto, SubmissionsQueryDto, SubmitFormDto, UpdateSubmissionDto } from './forms.dto';
import { FormDefinition, FormSubmission, FormSubmissionFile, FormSubmissionMessage } from './forms.entity';
import { FormsWebhookService } from './forms-webhook.service';
import { decryptValue, encryptValue, encryptionEnabled } from './forms-crypto';
import { DEFAULT_STATUSES, DISPLAY_TYPES, FieldDef, cleanAnswers, cleanCategories, cleanFields, cleanIntegrations, cleanStatuses, displayValue, isValidSlug } from './field-schema';

export const FORMS_FOLDER = 'private/forms';
export const SENSITIVE_PERM = 'forms.submissions.sensitive';
const MASK = '••••••';
const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const reference = (s: { id: number; createdAt: Date }) => `FRM-${new Date(s.createdAt).getFullYear()}-${String(s.id).padStart(5, '0')}`;
const emails = (s: string | null) => (s ?? '').split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(x));

@Injectable()
export class FormsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FormsService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(FormDefinition) private readonly forms: Repository<FormDefinition>,
    @InjectRepository(FormSubmission) private readonly subs: Repository<FormSubmission>,
    @InjectRepository(FormSubmissionFile) private readonly files: Repository<FormSubmissionFile>,
    @InjectRepository(FormSubmissionMessage) private readonly messages: Repository<FormSubmissionMessage>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    private readonly mail: MailService,
    private readonly hooks: FormsWebhookService,
  ) {}

  onModuleInit() {
    if (encryptionEnabled()) this.logger.log('Forms: sensitive answers are encrypted at rest (FORMS_ENCRYPTION_KEY is set).');
    else this.logger.warn('Forms: FORMS_ENCRYPTION_KEY is not set, so sensitive answers are stored unencrypted. Set it in the backend environment.');
    // retention: expired submissions are removed on start and then every 6 hours
    setTimeout(() => void this.purgeExpired(), 60_000).unref();
    this.timer = setInterval(() => void this.purgeExpired(), 6 * 3600_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ================================================================================== form definitions (admin)
  async list() {
    const rows = await this.forms.find({ order: { createdAt: 'DESC' } });
    const counts = await this.subs.createQueryBuilder('s').select('s.formId', 'formId').addSelect('COUNT(*)', 'total').addSelect('SUM(CASE WHEN s.isRead THEN 0 ELSE 1 END)', 'unread').groupBy('s.formId').getRawMany();
    const by = new Map(counts.map((c) => [Number(c.formId), c]));
    return rows.map((f) => ({ ...f, integrations: f.integrations.map(({ secret, ...h }) => ({ ...h, hasSecret: !!secret })), submissionsTotal: Number(by.get(f.id)?.total ?? 0), submissionsUnread: Number(by.get(f.id)?.unread ?? 0) }));
  }

  async one(id: number) {
    const f = await this.forms.findOne({ where: { id } });
    if (!f) throw new NotFoundException('النموذج غير موجود');
    return { ...f, integrations: f.integrations.map(({ secret, ...h }) => ({ ...h, hasSecret: !!secret })) };
  }

  /** The secret of a webhook is write-only: the editor sends it back empty to keep the stored one. */
  private mergeIntegrations(input: unknown, old: FormDefinition['integrations'] = []) {
    const cleaned = cleanIntegrations(input);
    return cleaned.map((h, i) => {
      const raw = (input as any[])[i];
      if (!h.secret && raw?.keepSecret) {
        const prev = old.find((o) => o.url === h.url || o.name === h.name);
        if (prev?.secret) h.secret = prev.secret;
      }
      return h;
    });
  }

  async create(dto: SaveFormDto, actor: AuthUser) {
    if (!dto.slug || !isValidSlug(dto.slug)) throw new BadRequestException('الرابط المختصر مطلوب (أحرف إنكليزية صغيرة وأرقام وشرطات)');
    if (!dto.titleAr) throw new BadRequestException('عنوان النموذج مطلوب');
    if (await this.forms.exist({ where: { slug: dto.slug } })) throw new ConflictException('الرابط المختصر مستخدم لنموذج آخر');
    const f = this.forms.create({
      slug: dto.slug, titleAr: dto.titleAr, titleEn: dto.titleEn ?? null,
      descriptionAr: dto.descriptionAr ? sanitizeRichText(dto.descriptionAr) : null, descriptionEn: dto.descriptionEn ? sanitizeRichText(dto.descriptionEn) : null,
      successAr: dto.successAr ?? null, successEn: dto.successEn ?? null,
      isOpen: dto.isOpen ?? true, isListed: dto.isListed ?? true,
      fields: cleanFields(dto.fields ?? []), statuses: cleanStatuses(dto.statuses), categories: cleanCategories(dto.categories),
      integrations: this.mergeIntegrations(dto.integrations),
      notifyEmails: dto.notifyEmails ?? null, sendReceipt: dto.sendReceipt ?? true, requireConsent: dto.requireConsent ?? true, retentionDays: dto.retentionDays ?? null, version: 1,
    });
    const saved = await this.forms.save(f);
    await this.audit.log({ category: 'forms', action: 'create', description: `إنشاء نموذج ${saved.slug}`, actorId: actor.id, entityType: 'form_definitions', entityId: saved.id });
    return this.one(saved.id);
  }

  async update(id: number, dto: SaveFormDto, actor: AuthUser) {
    const f = await this.forms.findOne({ where: { id } });
    if (!f) throw new NotFoundException('النموذج غير موجود');
    if (dto.slug !== undefined && dto.slug !== f.slug) {
      if (!isValidSlug(dto.slug)) throw new BadRequestException('الرابط المختصر غير صالح');
      if (await this.forms.exist({ where: { slug: dto.slug } })) throw new ConflictException('الرابط المختصر مستخدم لنموذج آخر');
      f.slug = dto.slug;
    }
    if (dto.titleAr !== undefined) f.titleAr = dto.titleAr;
    if (dto.titleEn !== undefined) f.titleEn = dto.titleEn;
    if (dto.descriptionAr !== undefined) f.descriptionAr = dto.descriptionAr ? sanitizeRichText(dto.descriptionAr) : null;
    if (dto.descriptionEn !== undefined) f.descriptionEn = dto.descriptionEn ? sanitizeRichText(dto.descriptionEn) : null;
    if (dto.successAr !== undefined) f.successAr = dto.successAr;
    if (dto.successEn !== undefined) f.successEn = dto.successEn;
    if (dto.isOpen !== undefined) f.isOpen = dto.isOpen;
    if (dto.isListed !== undefined) f.isListed = dto.isListed;
    if (dto.notifyEmails !== undefined) f.notifyEmails = dto.notifyEmails;
    if (dto.sendReceipt !== undefined) f.sendReceipt = dto.sendReceipt;
    if (dto.requireConsent !== undefined) f.requireConsent = dto.requireConsent;
    if (dto.retentionDays !== undefined) f.retentionDays = dto.retentionDays;
    if (dto.categories !== undefined) f.categories = cleanCategories(dto.categories);
    if (dto.integrations !== undefined) f.integrations = this.mergeIntegrations(dto.integrations, f.integrations);
    if (dto.statuses !== undefined) {
      const next = cleanStatuses(dto.statuses);
      // a status that requests still use cannot disappear
      const used = await this.subs.createQueryBuilder('s').select('DISTINCT s.status', 'status').where('s.formId = :id', { id }).getRawMany();
      const missing = used.map((u) => u.status).filter((k) => !next.some((s) => s.key === k));
      if (missing.length) throw new BadRequestException(`لا يمكن حذف حالة مستخدمة في طلبات: ${missing.join('، ')}`);
      f.statuses = next;
    }
    if (dto.fields !== undefined) {
      const next = cleanFields(dto.fields);
      if (JSON.stringify(next) !== JSON.stringify(f.fields)) {
        f.fields = next;
        f.version += 1; // old submissions keep their own snapshot, so this never touches them
      }
    }
    await this.forms.save(f);
    await this.audit.log({ category: 'forms', action: 'update', description: `تعديل نموذج ${f.slug}`, actorId: actor.id, entityType: 'form_definitions', entityId: id, details: { version: f.version, fields: f.fields.length } });
    return this.one(id);
  }

  async duplicate(id: number, slug: string, actor: AuthUser) {
    const src = await this.forms.findOne({ where: { id } });
    if (!src) throw new NotFoundException('النموذج غير موجود');
    if (await this.forms.exist({ where: { slug } })) throw new ConflictException('الرابط المختصر مستخدم لنموذج آخر');
    const { id: _i, createdAt: _c, updatedAt: _u, submissions: _s, integrations, ...rest } = src as any;
    const copy = await this.forms.save(this.forms.create({ ...rest, slug, titleAr: `${src.titleAr} (نسخة)`, isOpen: false, integrations: [], version: 1 }));
    await this.audit.log({ category: 'forms', action: 'create', description: `نسخ نموذج ${src.slug} إلى ${slug}`, actorId: actor.id, entityType: 'form_definitions', entityId: (copy as any).id });
    return this.one((copy as any).id);
  }

  async remove(id: number, deleteSubmissions: boolean, actor: AuthUser) {
    const f = await this.forms.findOne({ where: { id } });
    if (!f) throw new NotFoundException('النموذج غير موجود');
    const count = await this.subs.count({ where: { formId: id } });
    if (count > 0 && !deleteSubmissions) throw new ConflictException(`للنموذج ${count} طلباً. أغلق النموذج بدل حذفه، أو أكّد حذف الطلبات معه`);
    const paths = (await this.files.createQueryBuilder('f').innerJoin('f.submission', 's').where('s.formId = :id', { id }).getMany()).map((x) => x.path);
    await this.forms.delete({ id }); // submissions, their files and messages go with it (ON DELETE CASCADE)
    await this.storage.removeMany(paths);
    await this.audit.log({ category: 'forms', action: 'delete', description: `حذف نموذج ${f.slug} و${count} طلباً`, actorId: actor.id, entityType: 'form_definitions', entityId: id });
    return { deleted: true, submissionsDeleted: count };
  }

  // ================================================================================== public
  async publicList(lang: string) {
    const en = lang === 'en';
    const rows = await this.forms.find({ where: { isListed: true }, order: { createdAt: 'DESC' } });
    return rows.map((f) => ({ slug: f.slug, title: (en && f.titleEn) || f.titleAr, description: (en && f.descriptionEn) || f.descriptionAr, isOpen: f.isOpen }));
  }

  /** the definition a visitor needs to draw the form: nothing about staff, e-mails, integrations or retention */
  async publicOne(slug: string) {
    const f = await this.forms.findOne({ where: { slug } });
    if (!f) throw new NotFoundException('النموذج غير موجود');
    return {
      slug: f.slug, titleAr: f.titleAr, titleEn: f.titleEn, descriptionAr: f.descriptionAr, descriptionEn: f.descriptionEn, isOpen: f.isOpen, requireConsent: f.requireConsent,
      fields: f.fields,
    };
  }

  private async saveUpload(field: FieldDef, file: Express.Multer.File): Promise<string> {
    const kinds = field.fileKinds ?? ['image', 'pdf', 'doc'];
    if (file.size > (field.maxSizeMb ?? 5) * 1024 * 1024) throw new BadRequestException(`الملف "${file.originalname}" يتجاوز ${field.maxSizeMb ?? 5} ميغابايت`);
    const isPdf = file.buffer.subarray(0, 5).toString('latin1') === '%PDF-';
    if (isPdf) {
      if (!kinds.includes('pdf') && !kinds.includes('doc')) throw new BadRequestException(`نوع الملف "${file.originalname}" غير مسموح في "${field.labelAr}"`);
      return this.storage.savePdf(file, FORMS_FOLDER);
    }
    if (this.storage.detectImage(file.buffer)) {
      if (!kinds.includes('image')) throw new BadRequestException(`نوع الملف "${file.originalname}" غير مسموح في "${field.labelAr}"`);
      return this.storage.saveImage(file, FORMS_FOLDER, 1800);
    }
    if (kinds.includes('doc') && this.storage.detectDocument(file.buffer, file.originalname)) return this.storage.saveDocument(file, FORMS_FOLDER);
    throw new BadRequestException(`نوع الملف "${file.originalname}" غير مسموح في "${field.labelAr}"`);
  }

  async submit(slug: string, dto: SubmitFormDto, uploads: Express.Multer.File[]) {
    const form = await this.forms.findOne({ where: { slug } });
    if (!form) throw new NotFoundException('النموذج غير موجود');
    if (!form.isOpen) throw new BadRequestException('باب التقديم على هذا النموذج مغلق حالياً');
    const lang = dto.lang === 'en' ? 'en' : 'ar';
    if (dto.website) return { id: 0, reference: '', message: this.successText(form, lang) }; // honeypot: pretend, store nothing
    if (form.requireConsent && dto.consent !== 'true') throw new BadRequestException('يجب الموافقة على سياسة الخصوصية قبل الإرسال');

    let input: unknown;
    try { input = JSON.parse(dto.data); } catch { throw new BadRequestException('بيانات النموذج غير صالحة'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('بيانات النموذج غير صالحة');
    const { answers, fileFields } = cleanAnswers(form.fields, input as Record<string, any>);

    // files: only the files of the form's own file fields are read; everything else that was sent is ignored
    const byField = new Map<string, Express.Multer.File[]>();
    for (const u of uploads) {
      if (!u.fieldname.startsWith('f_')) continue;
      const k = u.fieldname.slice(2);
      byField.set(k, [...(byField.get(k) ?? []), u]);
    }
    for (const ff of fileFields) {
      const n = byField.get(ff.key)?.length ?? 0;
      if (ff.required && n === 0) throw new BadRequestException(`الحقل "${ff.labelAr}" مطلوب`);
      if (n > (ff.maxFiles ?? 1)) throw new BadRequestException(`الحد الأقصى ${ff.maxFiles ?? 1} من الملفات في "${ff.labelAr}"`);
    }

    const saved: { fieldKey: string; originalName: string; path: string; size: number }[] = [];
    try {
      for (const ff of fileFields) {
        for (const f of byField.get(ff.key) ?? []) saved.push({ fieldKey: ff.key, originalName: (f.originalname || 'file').slice(0, 255), path: await this.saveUpload(ff, f), size: f.size });
      }
    } catch (e) {
      await this.storage.removeMany(saved.map((s) => s.path));
      throw e;
    }

    const roleValue = (role: string) => {
      const f = form.fields.find((x) => x.role === role);
      const v = f ? answers[f.key] : undefined;
      return typeof v === 'string' && v ? v : null;
    };
    const stored: Record<string, any> = {};
    for (const f of form.fields) if (answers[f.key] !== undefined) stored[f.key] = f.sensitive ? encryptValue(answers[f.key]) : answers[f.key];

    let sub: FormSubmission;
    try {
      sub = await this.subs.save(this.subs.create({
        formId: form.id, formVersion: form.version, fieldsSnapshot: form.fields, answers: stored,
        applicantName: roleValue('name')?.slice(0, 200) ?? null, applicantEmail: roleValue('email')?.slice(0, 190) ?? null, applicantPhone: roleValue('phone')?.slice(0, 60) ?? null,
        status: (form.statuses[0] ?? DEFAULT_STATUSES[0]).key, category: null, staffNotes: null, isRead: false, consentAt: form.requireConsent ? new Date() : null, anonymizedAt: null,
      }));
      if (saved.length) await this.files.save(saved.map((s) => this.files.create({ submissionId: sub.id, ...s })));
    } catch (e) {
      await this.storage.removeMany(saved.map((s) => s.path));
      throw e;
    }

    const ref = reference(sub);
    // the log names the request, never the answers (personal data stays in form_submissions only)
    await this.audit.log({ category: 'forms', action: 'submit', description: `طلب جديد ${ref} (${form.slug})`, entityType: 'form_submissions', entityId: sub.id });
    this.notify(form, sub, ref, saved.length);
    this.hooks.dispatch(form, 'submitted', this.hookPayload(form, sub, ref, answers));
    return { id: sub.id, reference: ref, message: this.successText(form, lang) };
  }

  private successText(f: FormDefinition, lang: string) {
    return (lang === 'en' ? f.successEn : f.successAr) || (lang === 'en' ? 'Your request has been received.' : 'تم استلام طلبك بنجاح');
  }

  /** non-sensitive answers only: what the chamber's other systems may receive */
  private hookPayload(form: FormDefinition, sub: FormSubmission, ref: string, plain: Record<string, any>) {
    const open: Record<string, any> = {};
    for (const f of form.fields) if (!f.sensitive && plain[f.key] !== undefined) open[f.key] = plain[f.key];
    return { submissionId: sub.id, reference: ref, status: sub.status, category: sub.category, answers: open };
  }

  /** Never throws: a mail problem must not fail the applicant's request. Staff e-mails carry no answers, only who / what / how many files. */
  private notify(form: FormDefinition, sub: FormSubmission, ref: string, fileCount: number) {
    const front = (process.env.FRONTEND_URL || (process.env.CORS_ORIGINS ?? '').split(',')[0] || '').trim().replace(/\/+$/, '');
    const link = front ? `${front}/ar/admin/settings/?page=forms&tab=submissions` : '';
    const staff = emails(form.notifyEmails);
    const name = sub.applicantName ? ` — ${esc(sub.applicantName)}` : '';
    for (const to of staff) {
      void this.mail.as('forms').send(to, `طلب جديد ${ref}: ${form.titleAr}`,
        `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h3>طلب جديد ${ref}</h3><p><b>النموذج:</b> ${esc(form.titleAr)}${name}<br><b>عدد المرفقات:</b> ${fileCount}</p>${link ? `<p><a href="${esc(link)}">فتح لوحة الطلبات</a></p>` : ''}<p style="color:#666;font-size:12px">لحماية البيانات الشخصية لا تتضمن هذه الرسالة محتوى الطلب. افتحه من لوحة التحكم.</p></div>`);
    }
    if (form.sendReceipt && sub.applicantEmail) {
      void this.mail.as('forms').send(sub.applicantEmail, `استلمنا طلبك ${ref}`,
        `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><p>شكراً لك، استلمنا طلبك على نموذج <b>${esc(form.titleAr)}</b>.</p><p>رقم الطلب: <b>${ref}</b></p><p>سنراجع الطلب ونتواصل معك على هذا البريد.</p></div>`);
    }
  }

  // ================================================================================== submissions (admin)
  private build(q: SubmissionsQueryDto) {
    const qb = this.subs.createQueryBuilder('s').leftJoin('s.form', 'f').addSelect(['f.id', 'f.slug', 'f.titleAr', 'f.titleEn', 'f.statuses', 'f.categories']);
    if (q.formId) qb.andWhere('s.formId = :fid', { fid: q.formId });
    if (q.status) qb.andWhere('s.status = :st', { st: q.status });
    if (q.category) qb.andWhere('s.category = :cat', { cat: q.category });
    if (q.unread === 'true') qb.andWhere('s.isRead = false');
    if (q.from) qb.andWhere('s.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('s.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('s.applicantName ILIKE :like', { like }).orWhere('s.applicantEmail ILIKE :like', { like }).orWhere('s.applicantPhone ILIKE :like', { like }).orWhere('f.titleAr ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { applicantName: 's.applicantName', applicantEmail: 's.applicantEmail', applicantPhone: 's.applicantPhone', form: 'f.titleAr', createdAt: 'CAST(s.createdAt AS TEXT)' });
    qb.orderBy('s.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('s.id', 'DESC');
    return qb;
  }

  private row(s: FormSubmission) {
    const { answers: _a, fieldsSnapshot: _f, ...rest } = s as any;
    return { ...rest, reference: reference(s), form: s.form ? { id: s.form.id, slug: s.form.slug, titleAr: s.form.titleAr, titleEn: s.form.titleEn } : null };
  }

  async listSubmissions(q: SubmissionsQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.build(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.row(r)), total, p);
  }

  /** answers as the person may see them: decrypted, and the sensitive ones masked unless the user holds forms.submissions.sensitive */
  private reveal(s: FormSubmission, actor: AuthUser) {
    const may = actor.permissions.has(SENSITIVE_PERM);
    const out: Record<string, any> = {};
    for (const f of s.fieldsSnapshot) {
      if (DISPLAY_TYPES.includes(f.type) || s.answers[f.key] === undefined) continue;
      out[f.key] = f.sensitive && !may ? MASK : decryptValue(s.answers[f.key]);
    }
    return out;
  }

  async oneSubmission(id: number, actor: AuthUser) {
    const s = await this.subs.findOne({ where: { id }, relations: { form: true } });
    if (!s) throw new NotFoundException('الطلب غير موجود');
    const may = actor.permissions.has(SENSITIVE_PERM);
    if (!s.isRead) {
      s.isRead = true;
      await this.subs.save(s);
    }
    const [files, msgs] = await Promise.all([this.files.find({ where: { submissionId: id }, order: { id: 'ASC' } }), this.messages.find({ where: { submissionId: id }, order: { id: 'DESC' } })]);
    // viewing personal data is itself logged (who looked at which request), never what it contained
    await this.audit.log({ category: 'forms', action: 'read', description: `عرض الطلب ${reference(s)}`, actorId: actor.id, entityType: 'form_submissions', entityId: id, details: { sensitiveShown: may } });
    return {
      ...this.row(s), fields: s.fieldsSnapshot, answers: this.reveal(s, actor),
      statuses: s.form?.statuses ?? DEFAULT_STATUSES, categories: s.form?.categories ?? [],
      files: may ? files.map((f) => ({ id: f.id, fieldKey: f.fieldKey, name: f.originalName, size: f.size, path: f.path })) : [], filesHidden: !may && files.length > 0,
      messages: msgs,
    };
  }

  async updateSubmission(id: number, dto: UpdateSubmissionDto, actor: AuthUser) {
    const s = await this.subs.findOne({ where: { id }, relations: { form: true } });
    if (!s) throw new NotFoundException('الطلب غير موجود');
    const form = s.form!;
    const before = s.status;
    if (dto.status !== undefined) {
      if (!form.statuses.some((x) => x.key === dto.status)) throw new BadRequestException('حالة غير معرّفة في هذا النموذج');
      s.status = dto.status;
    }
    if (dto.category !== undefined) {
      if (dto.category !== null && !form.categories.some((x) => x.key === dto.category)) throw new BadRequestException('تصنيف غير معرّف في هذا النموذج');
      s.category = dto.category;
    }
    if (dto.staffNotes !== undefined) s.staffNotes = dto.staffNotes;
    await this.subs.save(s);
    await this.audit.log({ category: 'forms', action: 'update', description: `تحديث الطلب ${reference(s)}`, actorId: actor.id, entityType: 'form_submissions', entityId: id, details: { status: s.status, category: s.category } });
    if (s.status !== before) this.hooks.dispatch(form, 'status_changed', { ...this.hookPayload(form, s, reference(s), {}), previousStatus: before });
    return this.row(s);
  }

  async bulkUpdate(ids: number[], dto: { status?: string; category?: string | null }, actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.subs.find({ where: { id: In(unique) }, relations: { form: true } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الطلبات غير موجودة');
    for (const s of rows) {
      if (dto.status !== undefined && !s.form!.statuses.some((x) => x.key === dto.status)) throw new BadRequestException('حالة غير معرّفة في أحد النماذج المختارة');
      if (dto.category && !s.form!.categories.some((x) => x.key === dto.category)) throw new BadRequestException('تصنيف غير معرّف في أحد النماذج المختارة');
    }
    for (const s of rows) {
      const before = s.status;
      if (dto.status !== undefined) s.status = dto.status;
      if (dto.category !== undefined) s.category = dto.category;
      await this.subs.save(s);
      if (s.status !== before) this.hooks.dispatch(s.form!, 'status_changed', { ...this.hookPayload(s.form!, s, reference(s), {}), previousStatus: before });
    }
    await this.audit.log({ category: 'forms', action: 'update', description: `تحديث ${rows.length} طلباً دفعة واحدة`, actorId: actor.id, entityType: 'form_submissions', details: { ids: unique, status: dto.status, category: dto.category } });
    return { updated: rows.length };
  }

  async contact(id: number, dto: ContactApplicantDto, actor: AuthUser) {
    const s = await this.subs.findOne({ where: { id } });
    if (!s) throw new NotFoundException('الطلب غير موجود');
    if (!s.applicantEmail) throw new BadRequestException('لا يوجد بريد إلكتروني لهذا المتقدم (أضف حقلاً بدور البريد في النموذج)');
    const ref = reference(s);
    const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><div style="white-space:pre-wrap">${esc(dto.body)}</div><hr><p style="color:#666;font-size:12px">بخصوص طلبك رقم ${ref}</p></div>`;
    const delivered = await this.mail.as('forms').send(s.applicantEmail, `${dto.subject} [${ref}]`, html);
    const m = await this.messages.save(this.messages.create({ submissionId: id, sentBy: actor.id, sentByName: actor.fullName?.slice(0, 150) ?? null, subject: dto.subject, body: dto.body, delivered }));
    await this.audit.log({ category: 'forms', action: 'contact', description: `مراسلة صاحب الطلب ${ref}`, actorId: actor.id, entityType: 'form_submissions', entityId: id, details: { delivered } });
    if (!delivered) throw new BadRequestException('تعذّر إرسال البريد (تحقق من إعدادات البريد). سُجّلت الرسالة في سجل المراسلات');
    return m;
  }

  /** Erasure on request (right to be forgotten): answers, files, contact details and notes are wiped; the row stays only so statistics by status / date remain true. */
  async anonymize(id: number, actor: AuthUser) {
    const s = await this.subs.findOne({ where: { id } });
    if (!s) throw new NotFoundException('الطلب غير موجود');
    const files = await this.files.find({ where: { submissionId: id } });
    await this.files.delete({ submissionId: id });
    await this.messages.delete({ submissionId: id });
    await this.storage.removeMany(files.map((f) => f.path));
    s.answers = {};
    s.applicantName = null; s.applicantEmail = null; s.applicantPhone = null; s.staffNotes = null; s.anonymizedAt = new Date();
    await this.subs.save(s);
    await this.audit.log({ category: 'forms', action: 'anonymize', description: `مسح البيانات الشخصية للطلب ${reference(s)}`, actorId: actor.id, entityType: 'form_submissions', entityId: id });
    return { anonymized: true };
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.subs.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الطلبات غير موجودة');
    const files = await this.files.find({ where: { submissionId: In(unique) } });
    await this.subs.delete({ id: In(unique) });
    await this.storage.removeMany(files.map((f) => f.path));
    await this.audit.log({ category: 'forms', action: 'delete', description: `حذف ${rows.length} من الطلبات`, actorId: actor.id, entityType: 'form_submissions', details: { ids: unique } });
    return { deleted: rows.length };
  }

  /** dashboard badge + latest unread (no answers) */
  async unread() {
    const [count, latest] = await Promise.all([
      this.subs.count({ where: { isRead: false } }),
      this.subs.createQueryBuilder('s').leftJoin('s.form', 'f').addSelect(['f.id', 'f.titleAr', 'f.titleEn']).where('s.isRead = false').orderBy('s.createdAt', 'DESC').take(5).getMany(),
    ]);
    return { count, latest: latest.map((s) => ({ id: s.id, reference: reference(s), form: s.form?.titleAr ?? '', applicantName: s.applicantName, createdAt: s.createdAt })) };
  }

  async purgeExpired() {
    try {
      const withRetention = await this.forms.createQueryBuilder('f').where('f.retentionDays IS NOT NULL').getMany();
      for (const f of withRetention) {
        const cutoff = new Date(Date.now() - f.retentionDays! * 86400_000);
        const old = await this.subs.find({ where: { formId: f.id, createdAt: LessThan(cutoff) }, select: { id: true }, take: 1000 });
        if (!old.length) continue;
        const ids = old.map((o) => o.id);
        const files = await this.files.find({ where: { submissionId: In(ids) } });
        await this.subs.delete({ id: In(ids) });
        await this.storage.removeMany(files.map((x) => x.path));
        await this.audit.log({ category: 'forms', action: 'retention.purge', description: `حذف ${ids.length} طلباً تجاوز مدة الاحتفاظ (${f.retentionDays} يوماً) في ${f.slug}`, entityType: 'form_definitions', entityId: f.id });
      }
    } catch (e) {
      this.logger.error(`Retention purge failed: ${(e as Error).message}`);
    }
  }

  // ================================================================================== export
  async exportRows(q: SubmissionsQueryDto, actor: AuthUser, ar: boolean) {
    const may = actor.permissions.has(SENSITIVE_PERM);
    const rows = await this.build(q).take(10000).getMany();
    // one column per field of the chosen form (its current fields plus any key only old submissions have); without a form only the common columns
    let fields: FieldDef[] = [];
    if (q.formId) {
      const f = await this.forms.findOne({ where: { id: q.formId } });
      const map = new Map<string, FieldDef>();
      for (const x of f?.fields ?? []) map.set(x.key, x);
      for (const r of rows) for (const x of r.fieldsSnapshot) if (!map.has(x.key)) map.set(x.key, x);
      fields = [...map.values()].filter((x) => !DISPLAY_TYPES.includes(x.type) && x.type !== 'file');
    }
    const statusLabel = (s: FormSubmission) => { const st = (s.form?.statuses ?? DEFAULT_STATUSES).find((x) => x.key === s.status); return st ? (!ar && st.en ? st.en : st.ar) : s.status; };
    const catLabel = (s: FormSubmission) => { const c = (s.form?.categories ?? []).find((x) => x.key === s.category); return c ? (!ar && c.en ? c.en : c.ar) : s.category ?? ''; };
    const columns = [
      { key: 'reference', label: ar ? 'رقم الطلب' : 'Reference', value: (r: FormSubmission) => reference(r) },
      { key: 'form', label: ar ? 'النموذج' : 'Form', value: (r: FormSubmission) => (ar ? r.form?.titleAr : r.form?.titleEn || r.form?.titleAr) ?? '' },
      { key: 'name', label: ar ? 'الاسم' : 'Name', value: (r: FormSubmission) => r.applicantName ?? '' },
      { key: 'email', label: ar ? 'البريد' : 'Email', value: (r: FormSubmission) => r.applicantEmail ?? '' },
      { key: 'phone', label: ar ? 'الهاتف' : 'Phone', value: (r: FormSubmission) => r.applicantPhone ?? '' },
      { key: 'status', label: ar ? 'الحالة' : 'Status', value: statusLabel },
      { key: 'category', label: ar ? 'التصنيف' : 'Category', value: catLabel },
      { key: 'notes', label: ar ? 'ملاحظات الموظف' : 'Staff notes', value: (r: FormSubmission) => r.staffNotes ?? '' },
      { key: 'createdAt', label: ar ? 'تاريخ التقديم' : 'Submitted at', value: (r: FormSubmission) => r.createdAt },
      ...fields.map((f) => ({
        key: `a_${f.key}`, label: (!ar && f.labelEn) || f.labelAr,
        value: (r: FormSubmission) => {
          const snap = r.fieldsSnapshot.find((x) => x.key === f.key) ?? f;
          if (r.answers[f.key] === undefined) return '';
          if (snap.sensitive && !may) return MASK;
          return displayValue(snap, decryptValue(r.answers[f.key]), ar ? 'ar' : 'en');
        },
      })),
    ];
    return { rows, columns };
  }
}
