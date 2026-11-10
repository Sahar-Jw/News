import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { MailService } from '../mail/mail.service';
import { SiteSetting } from '../settings/site-setting.entity';
import { IncubatorApplication } from './incubator-application.entity';
import { CC } from '../../common/content-categories';
import { ContentStore, Rec, isActive, pick, s, sortOf } from '../content/content.store';
import { filterByCf, matches, pageRows } from '../content/mem';
import { ProjectStatus } from './incubator-project.entity';
import { ApplicationsAdminQueryDto, ApplyDto, CreateProjectDto, ProjectsAdminQueryDto, UpdateApplicationDto, UpdateProjectDto } from './incubator.dto';

export const INCUBATOR_FOLDER = 'private/incubator';
/** "INC-2026-00042": shown to the applicant and used by the staff; derived from the id, nothing extra to store. */
export const incubatorReference = (a: { id: number; createdAt: Date }) => `INC-${new Date(a.createdAt).getFullYear()}-${String(a.id).padStart(5, '0')}`;

const TEXT = ['nameEn', 'sectorAr', 'sectorEn', 'founderAr', 'founderEn', 'summaryAr', 'summaryEn', 'storyAr', 'storyEn', 'website'] as const;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

@Injectable()
export class IncubatorService {
  private readonly logger = new Logger(IncubatorService.name);

  constructor(
    private readonly store: ContentStore,
    @InjectRepository(IncubatorApplication) private readonly apps: Repository<IncubatorApplication>,
    @InjectRepository(SiteSetting) private readonly settings: Repository<SiteSetting>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------- projects: admin
  /** a project as the old entity looked: `extra` fields flattened, name = news title, story = news body, logo = news image */
  private view(r: Rec) {
    const x = r.x;
    return {
      id: r.id, status: (x.status ?? 'incubated') as ProjectStatus, nameAr: r.title, nameEn: s(x.nameEn), sectorAr: s(x.sectorAr), sectorEn: s(x.sectorEn), founderAr: s(x.founderAr), founderEn: s(x.founderEn),
      summaryAr: s(x.summaryAr), summaryEn: s(x.summaryEn), storyAr: r.body ?? '', storyEn: s(x.storyEn), website: s(x.website), joinedYear: (x.joinedYear ?? null) as number | null,
      sortOrder: sortOf(r), isActive: isActive(r), image: r.images[0] ?? null, createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }

  private presentProject(r: Rec) {
    const p = this.view(r);
    const out: Record<string, unknown> = { id: p.id, status: p.status, nameAr: p.nameAr, joinedYear: p.joinedYear, sortOrder: p.sortOrder, isActive: p.isActive, imageUrl: this.storage.url(p.image), createdAt: p.createdAt, updatedAt: p.updatedAt };
    for (const f of TEXT) out[f] = (p as Record<string, any>)[f] ?? '';
    return out;
  }

  /** manual order, then name, then id (what ORDER BY sort_order, name_ar, id did) */
  private static order = (a: { sortOrder: number; nameAr: string; id: number }, b: { sortOrder: number; nameAr: string; id: number }) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr) || a.id - b.id;

  async listProjects(q: ProjectsAdminQueryDto) {
    let rows = (await this.store.list(CC.INCUBATOR_PROJECT)).map((r) => ({ r, v: this.view(r) }));
    if (q.status) rows = rows.filter(({ v }) => v.status === q.status);
    if (q.q) rows = rows.filter(({ v }) => matches([v.nameAr, v.nameEn, v.sectorAr, v.founderAr], q.q!));
    rows = filterByCf(rows, q.cf, { nameAr: (x) => [x.v.nameAr], nameEn: (x) => [x.v.nameEn], sectorAr: (x) => [x.v.sectorAr], founderAr: (x) => [x.v.founderAr] });
    rows.sort((a, b) => IncubatorService.order(a.v, b.v));
    return pageRows(rows, q, (x) => this.presentProject(x.r));
  }

  private xOf(dto: UpdateProjectDto | CreateProjectDto) {
    const x: Record<string, any> = { status: dto.status, joinedYear: dto.joinedYear === undefined ? undefined : dto.joinedYear ?? null, sortOrder: dto.sortOrder === undefined ? undefined : dto.sortOrder ?? 0, isActive: dto.isActive };
    for (const f of TEXT) {
      if (f === 'storyAr') continue; // the Arabic story is the news body
      const v = (dto as any)[f];
      if (v !== undefined) x[f] = typeof v === 'string' ? v.trim() || null : null;
    }
    return x;
  }
  private storyOf(dto: UpdateProjectDto | CreateProjectDto) {
    const v = (dto as any).storyAr;
    return v === undefined ? undefined : typeof v === 'string' ? v.trim() || null : null;
  }

  async createProject(dto: CreateProjectDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const path = image ? await this.storage.saveImage(image, 'incubator', 1200) : null;
    try {
      const x = this.xOf(dto);
      const r = await this.store.create(CC.INCUBATOR_PROJECT, { title: dto.nameAr.trim(), body: this.storyOf(dto) ?? null, images: path ? [path] : [], x: { ...x, status: x.status ?? 'incubated', sortOrder: x.sortOrder ?? 0, isActive: x.isActive ?? true } });
      await this.audit.log({ category: 'incubator', action: 'create', description: `إضافة مشروع حاضنة: ${r.title}`, actorId: actor.id, entityType: 'incubator_projects', entityId: r.id });
      return this.presentProject(r);
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }

  async updateProject(id: number, dto: UpdateProjectDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const cur = await this.store.get(id, CC.INCUBATOR_PROJECT);
    if (!cur) throw new NotFoundException('المشروع غير موجود');
    const newPath = image ? await this.storage.saveImage(image, 'incubator', 1200) : null;
    const oldPath = cur.images[0] ?? null;
    try {
      const r = await this.store.update(id, { title: dto.nameAr?.trim(), body: this.storyOf(dto), images: newPath ? [newPath] : dto.removeImage ? [] : undefined, x: this.xOf(dto) });
      if (oldPath && oldPath !== (r!.images[0] ?? null)) await this.storage.remove(oldPath);
      await this.audit.log({ category: 'incubator', action: 'update', description: `تعديل مشروع حاضنة: ${r!.title}`, actorId: actor.id, entityType: 'incubator_projects', entityId: id });
      return this.presentProject(r!);
    } catch (e) {
      await this.storage.remove(newPath);
      throw e;
    }
  }

  removeProject(id: number, actor: AuthUser) {
    return this.removeProjects([id], actor);
  }

  async removeProjects(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(CC.INCUBATOR_PROJECT);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض المشاريع غير موجودة'); // nothing is deleted
    await this.store.remove(unique);
    await this.storage.removeMany(rows.map((r) => r.images[0] ?? null));
    await this.audit.log({ category: 'incubator', action: 'delete', description: `حذف ${rows.length} مشروع من الحاضنة`, actorId: actor.id, entityType: 'incubator_projects', details: { ids: unique }, changes: removedChanges('incubator_projects', rows.map((r) => this.view(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public
  async publicAll(lang: 'ar' | 'en') {
    const en = lang === 'en';
    const rows = (await this.store.list(CC.INCUBATOR_PROJECT)).filter(isActive).map((r) => this.view(r)).sort(IncubatorService.order).slice(0, 1000);
    const card = (p: ReturnType<IncubatorService['view']>) => ({
      id: p.id, status: p.status, name: pick(p.nameAr, p.nameEn, en), sector: pick(p.sectorAr, p.sectorEn, en), founder: pick(p.founderAr, p.founderEn, en), summary: pick(p.summaryAr, p.summaryEn, en),
      story: pick(p.storyAr, p.storyEn, en), joinedYear: p.joinedYear, website: p.website || null, imageUrl: this.storage.url(p.image),
    });
    const all = rows.map(card);
    return { incubated: all.filter((x) => x.status === 'incubated'), graduated: all.filter((x) => x.status === 'graduated') };
  }

  // ---------------------------------------------------------------- applications
  private appQuery(q: ApplicationsAdminQueryDto) {
    const qb = this.apps.createQueryBuilder('a');
    if (q.status) qb.andWhere('a.status = :status', { status: q.status });
    if (q.from) qb.andWhere('a.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('a.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('a.projectName ILIKE :like', { like }).orWhere('a.founderName ILIKE :like', { like }).orWhere('a.email ILIKE :like', { like }).orWhere('a.phone ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { projectName: 'a.projectName', founderName: 'a.founderName', email: 'a.email', phone: 'a.phone', sector: 'a.sector', description: 'a.description', createdAt: 'CAST(a.createdAt AS TEXT)' });
    return qb.orderBy('a.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('a.id', 'DESC');
  }
  private presentApp(a: IncubatorApplication, withFile = false) {
    const out: Record<string, unknown> = {
      id: Number(a.id), reference: incubatorReference(a), status: a.status, projectName: a.projectName, founderName: a.founderName, email: a.email, phone: a.phone, sector: a.sector ?? '', stage: a.stage ?? '',
      description: a.description, feasibility: a.feasibility ?? '', targetAudience: a.targetAudience ?? '', team: a.team ?? '', needs: a.needs ?? '', hasProfile: !!a.profilePath, consentAt: a.consentAt, adminNote: a.adminNote ?? '', createdAt: a.createdAt,
    };
    // the project profile is a private file: only its link is given, and only in the detail view
    if (withFile) out.profile = a.profilePath ? { name: a.profileName ?? 'profile', url: this.storage.url(a.profilePath) } : null;
    return out;
  }
  async oneApplication(id: number) {
    const a = await this.apps.findOne({ where: { id } });
    if (!a) throw new NotFoundException('الطلب غير موجود');
    return this.presentApp(a, true);
  }
  async listApplications(q: ApplicationsAdminQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.appQuery(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.presentApp(r)), total, p);
  }
  async allApplications(q: ApplicationsAdminQueryDto) {
    return (await this.appQuery(q).take(10000).getMany()).map((r) => this.presentApp(r));
  }
  async updateApplication(id: number, dto: UpdateApplicationDto, actor: AuthUser) {
    const a = await this.apps.findOne({ where: { id } });
    if (!a) throw new NotFoundException('الطلب غير موجود');
    if (dto.status !== undefined) a.status = dto.status;
    if (dto.adminNote !== undefined) a.adminNote = typeof dto.adminNote === 'string' ? dto.adminNote.trim() || null : null;
    const saved = await this.apps.save(a);
    await this.audit.log({ category: 'incubator', action: 'update', description: `معالجة طلب حاضنة → ${saved.status}`, actorId: actor.id, entityType: 'incubator_applications', entityId: id });
    return this.presentApp(saved);
  }
  async removeApplications(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.apps.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الطلبات غير موجودة');
    await this.apps.delete({ id: In(unique) });
    await this.storage.removeMany(rows.map((r) => r.profilePath));
    // personal data is not copied into the audit log
    await this.audit.log({ category: 'incubator', action: 'delete', description: `حذف ${rows.length} طلب حاضنة`, actorId: actor.id, entityType: 'incubator_applications', details: { ids: unique }, changes: removedChanges('incubator_applications', rows, ['projectName', 'founderName', 'email', 'phone', 'description', 'feasibility', 'targetAudience', 'team', 'needs', 'profileName', 'profilePath', 'adminNote']) });
    return { deleted: rows.length };
  }

  /** Public form. Same e-mail + project within 10 minutes is the same request (double click). The optional profile / study is a private file. */
  async apply(dto: ApplyDto, profile: Express.Multer.File | undefined) {
    const en = dto.lang === 'en';
    const email = dto.email.trim().toLowerCase();
    const dup = await this.apps.createQueryBuilder('a').where('a.email = :email AND a.projectName = :n AND a.createdAt > :since', { email, n: dto.projectName.trim(), since: new Date(Date.now() - 10 * 60_000) }).getCount();
    if (dup) return { message: en ? 'Your request was already received. We will contact you soon.' : 'تم استلام طلبك مسبقاً، سنتواصل معك قريباً' };
    // content is checked (PDF / DOC / DOCX), never the extension; nothing saved when the request fails
    const path = profile ? await this.storage.saveDocument(profile, INCUBATOR_FOLDER) : null;
    let a: IncubatorApplication;
    try {
      a = await this.apps.save(this.apps.create({
        status: 'new', projectName: dto.projectName.trim(), founderName: dto.founderName.trim(), email, phone: dto.phone.trim(), sector: dto.sector.trim(), stage: dto.stage, description: dto.description.trim(),
        feasibility: dto.feasibility.trim(), targetAudience: dto.targetAudience.trim(), team: dto.team?.trim() || null, needs: dto.needs.trim(),
        profilePath: path, profileName: profile ? (profile.originalname || 'profile').slice(0, 255) : null, consentAt: new Date(),
      }));
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
    const ref = incubatorReference(a);
    // public form: no actor, and the applicant's data stays in incubator_applications, not in the log
    await this.audit.log({ category: 'incubator', action: 'create', description: `طلب جديد لحاضنة الأعمال ${ref}`, entityType: 'incubator_applications', entityId: a.id });
    void this.notify(a, ref, en ? 'en' : 'ar');
    return { reference: ref, message: en ? 'Your project was received. We will contact you soon.' : 'تم استلام مشروعك بنجاح، سنتواصل معك قريباً' };
  }

  /** Confirmation to the applicant + e-mail to the incubator team (setting incubator.officer_email, else the chamber's contact e-mail). Never fails the request. */
  private async notify(a: IncubatorApplication, ref: string, lang: 'ar' | 'en') {
    try {
      const en = lang === 'en';
      await this.mail.send(a.email, en ? 'We received your project' : 'استلمنا مشروعك',
        en ? `<div dir="ltr" style="font-family:Arial,sans-serif"><p>Thank you ${esc(a.founderName)}, we received your project "${esc(a.projectName)}" at the Business Incubator. Reference: <b>${ref}</b>. We will review it and contact you soon.</p></div>`
          : `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><p>شكراً لك ${esc(a.founderName)}، استلمنا مشروعك «${esc(a.projectName)}» في حاضنة الأعمال. رقم الطلب: <b>${ref}</b>. سنراجعه ونتواصل معك قريباً.</p></div>`);
      const get = async (category: string, key: string) => ((await this.settings.findOne({ where: { category, key } }))?.value ?? '').toString().trim();
      const to = (await get('incubator', 'officer_email')) || (await get('contact', 'email'));
      if (!to) return;
      const row = (k: string, v?: string | null) => (v ? `<p><b>${k}:</b> ${esc(v)}</p>` : '');
      const stage: Record<string, string> = { idea: 'فكرة أولية', prototype: 'قيد التطوير', launched: 'مشروع قائم' };
      const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h3>مشروع جديد لحاضنة الأعمال ${ref}</h3>${row('المشروع', a.projectName)}${row('مقدم الطلب', a.founderName)}${row('البريد', a.email)}${row('الهاتف', a.phone)}${row('القطاع', a.sector)}${row('المرحلة', a.stage ? stage[a.stage] ?? a.stage : null)}${row('الوصف', a.description)}${row('الجدوى الاقتصادية', a.feasibility)}${row('الفئة المستهدفة', a.targetAudience)}${row('فريق العمل', a.team)}${row('الاحتياجات المطلوبة', a.needs)}${a.profilePath ? '<p>مرفق: ملف تعريفي / دراسة (يُحمّل من لوحة الإدارة)</p>' : ''}</div>`;
      await this.mail.send(to, `مشروع جديد لحاضنة الأعمال ${ref}: ${a.projectName}`, html);
    } catch (e) {
      this.logger.error(`Could not send the incubator e-mails: ${(e as Error).message}`);
    }
  }
}
