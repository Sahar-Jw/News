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
import { IncubatorProject, ProjectStatus } from './incubator-project.entity';
import { ApplicationsAdminQueryDto, ApplyDto, CreateProjectDto, ProjectsAdminQueryDto, UpdateApplicationDto, UpdateProjectDto } from './incubator.dto';

const TEXT = ['nameEn', 'sectorAr', 'sectorEn', 'founderAr', 'founderEn', 'summaryAr', 'summaryEn', 'storyAr', 'storyEn', 'website'] as const;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

@Injectable()
export class IncubatorService {
  private readonly logger = new Logger(IncubatorService.name);

  constructor(
    @InjectRepository(IncubatorProject) private readonly projects: Repository<IncubatorProject>,
    @InjectRepository(IncubatorApplication) private readonly apps: Repository<IncubatorApplication>,
    @InjectRepository(SiteSetting) private readonly settings: Repository<SiteSetting>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------- projects: admin
  private presentProject(p: IncubatorProject) {
    const out: Record<string, unknown> = { id: Number(p.id), status: p.status, nameAr: p.nameAr, joinedYear: p.joinedYear, sortOrder: p.sortOrder, isActive: p.isActive, imageUrl: this.storage.url(p.image), createdAt: p.createdAt, updatedAt: p.updatedAt };
    for (const f of TEXT) out[f] = p[f] ?? '';
    return out;
  }

  async listProjects(q: ProjectsAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.projects.createQueryBuilder('p');
    if (q.status) qb.andWhere('p.status = :status', { status: q.status });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('p.nameAr ILIKE :like', { like }).orWhere('p.nameEn ILIKE :like', { like }).orWhere('p.sectorAr ILIKE :like', { like }).orWhere('p.founderAr ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { nameAr: 'p.nameAr', nameEn: 'p.nameEn', sectorAr: 'p.sectorAr', founderAr: 'p.founderAr' });
    qb.orderBy('p.sortOrder', 'ASC').addOrderBy('p.nameAr', 'ASC').addOrderBy('p.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.presentProject(r)), total, p);
  }

  private fill(p: IncubatorProject, dto: UpdateProjectDto | CreateProjectDto) {
    if (dto.status !== undefined) p.status = dto.status as ProjectStatus;
    if (dto.nameAr !== undefined) p.nameAr = dto.nameAr.trim();
    for (const f of TEXT) {
      const v = (dto as any)[f];
      if (v !== undefined) (p as any)[f] = typeof v === 'string' ? v.trim() || null : null;
    }
    if (dto.joinedYear !== undefined) p.joinedYear = dto.joinedYear ?? null;
    if (dto.sortOrder !== undefined) p.sortOrder = dto.sortOrder ?? 0;
    if (dto.isActive !== undefined) p.isActive = dto.isActive;
  }

  async createProject(dto: CreateProjectDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const path = image ? await this.storage.saveImage(image, 'incubator', 1200) : null;
    try {
      const p = this.projects.create({ image: path, isActive: true, sortOrder: 0 });
      this.fill(p, dto);
      const saved = await this.projects.save(p);
      await this.audit.log({ category: 'incubator', action: 'create', description: `إضافة مشروع حاضنة: ${saved.nameAr}`, actorId: actor.id, entityType: 'incubator_projects', entityId: saved.id });
      return this.presentProject(saved);
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }

  async updateProject(id: number, dto: UpdateProjectDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const p = await this.projects.findOne({ where: { id } });
    if (!p) throw new NotFoundException('المشروع غير موجود');
    const newPath = image ? await this.storage.saveImage(image, 'incubator', 1200) : null;
    const oldPath = p.image;
    try {
      this.fill(p, dto);
      if (newPath) p.image = newPath;
      else if (dto.removeImage) p.image = null;
      const saved = await this.projects.save(p);
      if (oldPath && oldPath !== saved.image) await this.storage.remove(oldPath);
      await this.audit.log({ category: 'incubator', action: 'update', description: `تعديل مشروع حاضنة: ${saved.nameAr}`, actorId: actor.id, entityType: 'incubator_projects', entityId: id });
      return this.presentProject(saved);
    } catch (e) {
      await this.storage.remove(newPath);
      throw e;
    }
  }

  async removeProjects(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.projects.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض المشاريع غير موجودة'); // nothing is deleted
    await this.projects.delete({ id: In(unique) });
    await this.storage.removeMany(rows.map((r) => r.image));
    await this.audit.log({ category: 'incubator', action: 'delete', description: `حذف ${rows.length} مشروع من الحاضنة`, actorId: actor.id, entityType: 'incubator_projects', details: { ids: unique }, changes: removedChanges('incubator_projects', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public
  async publicAll(lang: 'ar' | 'en') {
    const en = lang === 'en';
    const pick = (ar: string | null, e: string | null) => (en && e) || ar || '';
    const rows = await this.projects.find({ where: { isActive: true }, order: { sortOrder: 'ASC', nameAr: 'ASC', id: 'ASC' }, take: 1000 });
    const card = (p: IncubatorProject) => ({
      id: Number(p.id), status: p.status, name: pick(p.nameAr, p.nameEn), sector: pick(p.sectorAr, p.sectorEn), founder: pick(p.founderAr, p.founderEn), summary: pick(p.summaryAr, p.summaryEn),
      story: pick(p.storyAr, p.storyEn), joinedYear: p.joinedYear, website: p.website, imageUrl: this.storage.url(p.image),
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
  private presentApp(a: IncubatorApplication) {
    return { id: Number(a.id), status: a.status, projectName: a.projectName, founderName: a.founderName, email: a.email, phone: a.phone, sector: a.sector ?? '', stage: a.stage ?? '', description: a.description, adminNote: a.adminNote ?? '', createdAt: a.createdAt };
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
    // personal data is not copied into the audit log
    await this.audit.log({ category: 'incubator', action: 'delete', description: `حذف ${rows.length} طلب حاضنة`, actorId: actor.id, entityType: 'incubator_applications', details: { ids: unique }, changes: removedChanges('incubator_applications', rows, ['projectName', 'founderName', 'email', 'phone', 'description', 'adminNote']) });
    return { deleted: rows.length };
  }

  /** Public form. Same e-mail + project within 10 minutes is the same request (double click). */
  async apply(dto: ApplyDto) {
    const email = dto.email.trim().toLowerCase();
    const dup = await this.apps.createQueryBuilder('a').where('a.email = :email AND a.projectName = :n AND a.createdAt > :since', { email, n: dto.projectName.trim(), since: new Date(Date.now() - 10 * 60_000) }).getCount();
    if (dup) return { message: 'تم استلام طلبك مسبقاً، سنتواصل معك قريباً' };
    const a = await this.apps.save(this.apps.create({ status: 'new', projectName: dto.projectName.trim(), founderName: dto.founderName.trim(), email, phone: dto.phone.trim(), sector: dto.sector?.trim() || null, stage: dto.stage || null, description: dto.description.trim() }));
    void this.notify(a);
    return { message: 'تم استلام مشروعك بنجاح، سنتواصل معك قريباً' };
  }

  /** E-mail to the incubator team (setting incubator.officer_email, else the chamber's contact e-mail). Never fails the request. */
  private async notify(a: IncubatorApplication) {
    try {
      const get = async (category: string, key: string) => ((await this.settings.findOne({ where: { category, key } }))?.value ?? '').toString().trim();
      const to = (await get('incubator', 'officer_email')) || (await get('contact', 'email'));
      if (!to) return;
      const row = (k: string, v?: string | null) => (v ? `<p><b>${k}:</b> ${esc(v)}</p>` : '');
      const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h3>مشروع جديد لحاضنة الأعمال</h3>${row('المشروع', a.projectName)}${row('رائد الأعمال', a.founderName)}${row('البريد', a.email)}${row('الهاتف', a.phone)}${row('القطاع', a.sector)}${row('المرحلة', a.stage)}${row('الوصف', a.description)}</div>`;
      await this.mail.send(to, `مشروع جديد لحاضنة الأعمال: ${a.projectName}`, html);
    } catch (e) {
      this.logger.error(`Could not notify the incubator team: ${(e as Error).message}`);
    }
  }
}
