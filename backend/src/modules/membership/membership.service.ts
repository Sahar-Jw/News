import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike, sanitizeRichText } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { MailService } from '../mail/mail.service';
import { CC } from '../../common/content-categories';
import { ContentStore, Rec, pick } from '../content/content.store';
import { ApplyDto, MembershipAdminQueryDto, UpdateApplicationDto, UpdateMembershipSettingsDto } from './membership.dto';
import { MembershipApplication, MembershipFile, MembershipSettings, MembershipStatus } from './membership.entity';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const MEMBERSHIP_FOLDER = 'private/membership';
export const MAX_APPLICATION_FILES = 6;
/** "MB-2026-00042": shown to the applicant and used by the staff; derived from the id, nothing extra to store. */
export const reference = (a: { id: number; createdAt: Date }) => `MB-${new Date(a.createdAt).getFullYear()}-${String(a.id).padStart(5, '0')}`;

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(MembershipApplication) private readonly apps: Repository<MembershipApplication>,
    @InjectRepository(MembershipFile) private readonly files: Repository<MembershipFile>,
    private readonly store: ContentStore,
    @InjectRepository(MembershipSettings) private readonly settingsRepo: Repository<MembershipSettings>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------- settings (page content)
  /** the page texts: one news row (main category MEMBERSHIP_INFO), created on first use */
  private async infoRec(): Promise<Rec> {
    const hit = (await this.store.list(CC.MEMBERSHIP_INFO))[0];
    return hit ?? (await this.store.create(CC.MEMBERSHIP_INFO, { title: 'الانتساب', body: null, x: {} }));
  }

  /** notify e-mail + open flag stay in the (small) settings row */
  private async settingsRow() {
    return (await this.settingsRepo.findOne({ where: { id: 1 } })) ?? (await this.settingsRepo.save(this.settingsRepo.create({ id: 1, isOpen: true })));
  }

  /** texts (news row) + notify e-mail / open flag (settings row) in the shape the admin form always had */
  private async merged() {
    const [i, st] = await Promise.all([this.infoRec(), this.settingsRow()]);
    const n = (k: string) => (i.x[k] ?? null) as string | null;
    return {
      id: 1, conditionsAr: i.body ?? null, conditionsEn: n('conditionsEn'), documentsAr: n('documentsAr'), documentsEn: n('documentsEn'), feesAr: n('feesAr'), feesEn: n('feesEn'),
      stepsAr: n('stepsAr'), stepsEn: n('stepsEn'), notifyEmail: st.notifyEmail, isOpen: st.isOpen, createdAt: i.createdAt, updatedAt: st.updatedAt > i.updatedAt ? st.updatedAt : i.updatedAt,
    };
  }

  getSettings() {
    return this.merged();
  }

  async updateSettings(dto: UpdateMembershipSettingsDto, actor: AuthUser) {
    const i = await this.infoRec();
    const x: Record<string, any> = {};
    for (const k of ['conditionsEn', 'documentsAr', 'documentsEn', 'feesAr', 'feesEn'] as const) if (dto[k] !== undefined) x[k] = sanitizeRichText(dto[k]);
    for (const k of ['stepsAr', 'stepsEn'] as const) if (dto[k] !== undefined) x[k] = dto[k]?.trim() || null;
    await this.store.update(i.id, { body: dto.conditionsAr === undefined ? undefined : sanitizeRichText(dto.conditionsAr), x });
    const st = await this.settingsRow();
    if (dto.notifyEmail !== undefined) st.notifyEmail = dto.notifyEmail?.trim() || null;
    if (dto.isOpen !== undefined) st.isOpen = !!dto.isOpen;
    await this.settingsRepo.save(st);
    await this.audit.log({ category: 'membership', action: 'update', description: 'تعديل محتوى صفحة الانتساب وإعداداتها', actorId: actor.id, entityType: 'membership_settings', entityId: 1 });
    return this.merged();
  }

  async publicPage(lang: string) {
    const en = lang === 'en';
    const m = await this.merged();
    return {
      isOpen: m.isOpen, conditions: pick(m.conditionsAr, m.conditionsEn, en), documents: pick(m.documentsAr, m.documentsEn, en), fees: pick(m.feesAr, m.feesEn, en),
      steps: pick(m.stepsAr, m.stepsEn, en).split(/\r?\n/).map((x) => x.trim()).filter(Boolean),
    };
  }

  // ---------------------------------------------------------------- public: apply
  /** Store one uploaded document: pictures are validated and compressed, PDF/DOC/DOCX are checked by content. Everything goes to the private area. */
  private async saveUpload(f: Express.Multer.File) {
    return /^image\//.test(f.mimetype) ? this.storage.saveImage(f, MEMBERSHIP_FOLDER, 1800) : this.storage.saveDocument(f, MEMBERSHIP_FOLDER);
  }

  async apply(dto: ApplyDto, uploads: Express.Multer.File[]) {
    const s = await this.settingsRow();
    if (!s.isOpen) throw new BadRequestException('باب تقديم طلبات الانتساب مغلق حالياً');
    if (uploads.length > MAX_APPLICATION_FILES) throw new BadRequestException(`الحد الأقصى ${MAX_APPLICATION_FILES} ملفات`);
    // one open application per e-mail: stops duplicates and flooding
    const open = await this.apps.findOne({ where: { email: dto.email, status: In(['new', 'in_review']) } });
    if (open) throw new ConflictException('لديك طلب انتساب قيد المعالجة بهذا البريد');
    const saved: string[] = [];
    try {
      for (const f of uploads) saved.push(await this.saveUpload(f));
    } catch (e) {
      await this.storage.removeMany(saved);
      throw e;
    }
    let app: MembershipApplication;
    try {
      app = await this.apps.save(this.apps.create({ companyName: dto.companyName, activity: dto.activity, managerName: dto.managerName, phone: dto.phone, email: dto.email, address: dto.address ?? null, message: dto.message ?? null, status: 'new', staffNotes: null }));
      if (saved.length) await this.files.save(saved.map((path, i) => this.files.create({ applicationId: app.id, originalName: (uploads[i].originalname || 'file').slice(0, 255), path, size: uploads[i].size })));
    } catch (e) {
      await this.storage.removeMany(saved);
      throw e;
    }
    const ref = reference(app);
    await this.audit.log({ category: 'membership', action: 'create', description: `طلب انتساب جديد ${ref}`, entityType: 'membership_applications', entityId: app.id });
    if (s.notifyEmail) {
      const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h3>طلب انتساب جديد ${ref}</h3>`
        + `<p><b>المنشأة:</b> ${esc(dto.companyName)}<br><b>النشاط:</b> ${esc(dto.activity)}<br><b>المدير:</b> ${esc(dto.managerName)}<br><b>الهاتف:</b> ${esc(dto.phone)}<br><b>البريد:</b> ${esc(dto.email)}<br><b>عدد المرفقات:</b> ${saved.length}</p></div>`;
      void this.mail.send(s.notifyEmail, `طلب انتساب جديد ${ref}`, html);
    }
    void this.mail.send(dto.email, 'استلمنا طلب الانتساب', `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><p>شكراً لك، استلمنا طلب الانتساب الخاص بمنشأة <b>${esc(dto.companyName)}</b>.</p><p>رقم الطلب: <b>${ref}</b></p><p>سنراجع الطلب ونوافيك بالنتيجة على هذا البريد.</p></div>`);
    return { id: app.id, reference: ref, message: 'تم استلام طلب الانتساب' };
  }

  // ---------------------------------------------------------------- admin: applications
  private present(a: MembershipApplication, files?: MembershipFile[]) {
    return { ...a, reference: reference(a), ...(files && { files: files.map((f) => ({ id: f.id, name: f.originalName, size: f.size, path: f.path })) }) };
  }

  private build(q: MembershipAdminQueryDto) {
    const qb = this.apps.createQueryBuilder('a');
    if (q.status) qb.andWhere('a.status = :st', { st: q.status });
    if (q.from) qb.andWhere('a.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('a.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) { const like = `%${escapeLike(q.q)}%`; qb.andWhere(new Brackets((b) => b.where('a.companyName ILIKE :like', { like }).orWhere('a.managerName ILIKE :like', { like }).orWhere('a.email ILIKE :like', { like }).orWhere('a.phone ILIKE :like', { like }).orWhere('a.activity ILIKE :like', { like }))); }
    applyColumnFilters(qb, q.cf, { companyName: 'a.companyName', activity: 'a.activity', managerName: 'a.managerName', email: 'a.email', phone: 'a.phone', createdAt: 'CAST(a.createdAt AS TEXT)' });
    qb.orderBy('a.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('a.id', 'DESC');
    return qb;
  }

  async list(q: MembershipAdminQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.build(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  async listAll(q: MembershipAdminQueryDto) {
    return (await this.build(q).take(10000).getMany()).map((r) => this.present(r));
  }

  async one(id: number) {
    const a = await this.apps.findOne({ where: { id } });
    if (!a) throw new NotFoundException('الطلب غير موجود');
    return this.present(a, await this.files.find({ where: { applicationId: id }, order: { id: 'ASC' } }));
  }

  async update(id: number, dto: UpdateApplicationDto, actor: AuthUser) {
    const a = await this.apps.findOne({ where: { id } });
    if (!a) throw new NotFoundException('الطلب غير موجود');
    const before = a.status;
    if (dto.status !== undefined) a.status = dto.status as MembershipStatus;
    if (dto.staffNotes !== undefined) a.staffNotes = dto.staffNotes?.trim() || null;
    const saved = await this.apps.save(a);
    await this.audit.log({ category: 'membership', action: 'update', description: `تحديث طلب الانتساب ${reference(saved)} (${saved.status})`, actorId: actor.id, entityType: 'membership_applications', entityId: id });
    if (before !== saved.status && (saved.status === 'accepted' || saved.status === 'rejected')) {
      const ok = saved.status === 'accepted';
      void this.mail.send(saved.email, ok ? 'تم قبول طلب الانتساب' : 'بخصوص طلب الانتساب',
        `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><p>${ok ? 'يسرّنا إبلاغكم بقبول طلب الانتساب' : 'نأسف لإبلاغكم بتعذّر قبول طلب الانتساب حالياً'} (رقم الطلب <b>${reference(saved)}</b>) الخاص بمنشأة <b>${esc(saved.companyName)}</b>.</p><p>للاستفسار يرجى التواصل مع الغرفة.</p></div>`);
    }
    return this.present(saved, await this.files.find({ where: { applicationId: id }, order: { id: 'ASC' } }));
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.apps.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الطلبات غير موجودة'); // nothing is deleted
    const files = await this.files.find({ where: { applicationId: In(unique) } });
    await this.apps.delete({ id: In(unique) }); // the file rows go with it (ON DELETE CASCADE)
    await this.storage.removeMany(files.map((f) => f.path));
    await this.audit.log({ category: 'membership', action: 'delete', description: `حذف ${rows.length} من طلبات الانتساب`, actorId: actor.id, entityType: 'membership_applications', details: { ids: unique } });
    return { deleted: rows.length };
  }
}
