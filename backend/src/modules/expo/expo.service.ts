import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
import { ExpoApplication } from './expo-application.entity';
import { ExpoItem } from './expo-item.entity';
import { ApplicationsAdminQueryDto, ApplyDto, CreateExpoItemDto, ExpoItemsAdminQueryDto, UpdateApplicationDto, UpdateExpoItemDto } from './expo.dto';

const TEXT = ['nameEn', 'descriptionAr', 'descriptionEn', 'sectorAr', 'sectorEn', 'category', 'personAr', 'personEn', 'placeAr', 'placeEn', 'website'] as const;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const KIND_AR: Record<string, string> = { exhibitor: 'طلب مشاركة كعارض', visitor: 'تسجيل زائر', info: 'طلب معلومات' };

@Injectable()
export class ExpoService {
  private readonly logger = new Logger(ExpoService.name);

  constructor(
    @InjectRepository(ExpoItem) private readonly items: Repository<ExpoItem>,
    @InjectRepository(ExpoApplication) private readonly apps: Repository<ExpoApplication>,
    @InjectRepository(SiteSetting) private readonly settings: Repository<SiteSetting>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------- items: admin
  private presentAdmin(i: ExpoItem) {
    const out: Record<string, unknown> = {
      id: Number(i.id), kind: i.kind, nameAr: i.nameAr, startsAt: i.startsAt ? i.startsAt.toISOString() : '', endsAt: i.endsAt ? i.endsAt.toISOString() : '',
      sortOrder: i.sortOrder, isActive: i.isActive, logoUrl: this.storage.url(i.logo), createdAt: i.createdAt, updatedAt: i.updatedAt,
    };
    for (const f of TEXT) out[f] = i[f] ?? '';
    return out;
  }

  async list(q: ExpoItemsAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.items.createQueryBuilder('i').where('i.kind = :kind', { kind: q.kind });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('i.nameAr ILIKE :like', { like }).orWhere('i.nameEn ILIKE :like', { like }).orWhere('i.sectorAr ILIKE :like', { like }).orWhere('i.personAr ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { nameAr: 'i.nameAr', nameEn: 'i.nameEn', sectorAr: 'i.sectorAr', category: 'i.category', personAr: 'i.personAr', placeAr: 'i.placeAr' });
    if (q.kind === 'session') qb.orderBy('i.startsAt', 'ASC', 'NULLS LAST');
    else qb.orderBy('i.sortOrder', 'ASC');
    qb.addOrderBy('i.nameAr', 'ASC').addOrderBy('i.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.presentAdmin(r)), total, p);
  }

  private fill(i: ExpoItem, dto: UpdateExpoItemDto | CreateExpoItemDto) {
    if (dto.nameAr !== undefined) i.nameAr = dto.nameAr.trim();
    for (const f of TEXT) {
      const v = (dto as any)[f];
      if (v !== undefined) (i as any)[f] = typeof v === 'string' ? v.trim() || null : null;
    }
    if (dto.startsAt !== undefined) i.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
    if (dto.endsAt !== undefined) i.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (i.startsAt && i.endsAt && i.endsAt < i.startsAt) throw new BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية');
    if (dto.sortOrder !== undefined) i.sortOrder = dto.sortOrder ?? 0;
    if (dto.isActive !== undefined) i.isActive = dto.isActive;
  }

  async create(dto: CreateExpoItemDto, logo: Express.Multer.File | undefined, actor: AuthUser) {
    const path = logo ? await this.storage.saveImage(logo, 'expo', 800) : null;
    try {
      const i = this.items.create({ kind: dto.kind as ExpoItem['kind'], logo: path, isActive: true, sortOrder: 0 });
      this.fill(i, dto);
      const saved = await this.items.save(i);
      await this.audit.log({ category: 'expo', action: 'create', description: `إضافة إلى المعرض (${dto.kind}): ${saved.nameAr}`, actorId: actor.id, entityType: 'expo_items', entityId: saved.id });
      return this.presentAdmin(saved);
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }

  async update(id: number, dto: UpdateExpoItemDto, logo: Express.Multer.File | undefined, actor: AuthUser) {
    const i = await this.items.findOne({ where: { id } });
    if (!i) throw new NotFoundException('العنصر غير موجود');
    const newPath = logo ? await this.storage.saveImage(logo, 'expo', 800) : null;
    const oldPath = i.logo;
    try {
      this.fill(i, dto);
      if (newPath) i.logo = newPath;
      else if (dto.removeLogo) i.logo = null;
      const saved = await this.items.save(i);
      if (oldPath && oldPath !== saved.logo) await this.storage.remove(oldPath);
      await this.audit.log({ category: 'expo', action: 'update', description: `تعديل في المعرض (${saved.kind}): ${saved.nameAr}`, actorId: actor.id, entityType: 'expo_items', entityId: id });
      return this.presentAdmin(saved);
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
    const rows = await this.items.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض العناصر غير موجودة'); // nothing is deleted
    await this.items.delete({ id: In(unique) });
    await this.storage.removeMany(rows.map((r) => r.logo));
    await this.audit.log({ category: 'expo', action: 'delete', description: `حذف ${rows.length} عنصر من المعرض`, actorId: actor.id, entityType: 'expo_items', details: { ids: unique }, changes: removedChanges('expo_items', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- items: public
  /** Everything the EXPO site shows in one call (lists are small); the counters of the home page are computed here. */
  async publicAll(lang: 'ar' | 'en') {
    const en = lang === 'en';
    const pick = (ar: string | null, e: string | null) => (en && e) || ar || '';
    const rows = await this.items.find({ where: { isActive: true }, order: { sortOrder: 'ASC', nameAr: 'ASC', id: 'ASC' }, take: 2000 });
    const base = (i: ExpoItem) => ({ id: Number(i.id), name: pick(i.nameAr, i.nameEn), description: pick(i.descriptionAr, i.descriptionEn), website: i.website, logoUrl: this.storage.url(i.logo) });
    const exhibitors = rows.filter((r) => r.kind === 'exhibitor').map((i) => ({ ...base(i), sector: pick(i.sectorAr, i.sectorEn), booth: pick(i.placeAr, i.placeEn) }));
    const sponsors = rows.filter((r) => r.kind === 'sponsor').map((i) => ({ ...base(i), tier: i.category ?? 'partner' }));
    const sessions = rows
      .filter((r) => r.kind === 'session')
      .sort((a, b) => (a.startsAt?.getTime() ?? Infinity) - (b.startsAt?.getTime() ?? Infinity))
      .map((i) => ({ ...base(i), type: i.category ?? 'other', startsAt: i.startsAt, endsAt: i.endsAt, hall: pick(i.placeAr, i.placeEn), speaker: pick(i.personAr, i.personEn) }));
    const sectors = [...new Set(exhibitors.map((e) => e.sector).filter(Boolean))].sort();
    return { exhibitors, sponsors, sessions, sectors };
  }

  // ---------------------------------------------------------------- applications
  private appQuery(q: ApplicationsAdminQueryDto) {
    const qb = this.apps.createQueryBuilder('a');
    if (q.kind) qb.andWhere('a.kind = :kind', { kind: q.kind });
    if (q.status) qb.andWhere('a.status = :status', { status: q.status });
    if (q.from) qb.andWhere('a.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('a.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('a.name ILIKE :like', { like }).orWhere('a.email ILIKE :like', { like }).orWhere('a.phone ILIKE :like', { like }).orWhere('a.company ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { name: 'a.name', company: 'a.company', email: 'a.email', phone: 'a.phone', sector: 'a.sector', message: 'a.message', createdAt: 'CAST(a.createdAt AS TEXT)' });
    return qb.orderBy('a.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('a.id', 'DESC');
  }
  private presentApp(a: ExpoApplication) {
    return { id: Number(a.id), kind: a.kind, status: a.status, name: a.name, company: a.company ?? '', email: a.email, phone: a.phone, sector: a.sector ?? '', message: a.message ?? '', adminNote: a.adminNote ?? '', createdAt: a.createdAt };
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
    await this.audit.log({ category: 'expo', action: 'update', description: `معالجة طلب معرض (${saved.kind}) → ${saved.status}`, actorId: actor.id, entityType: 'expo_applications', entityId: id });
    return this.presentApp(saved);
  }
  async removeApplications(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.apps.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الطلبات غير موجودة');
    await this.apps.delete({ id: In(unique) });
    // personal data is not copied into the audit log
    await this.audit.log({ category: 'expo', action: 'delete', description: `حذف ${rows.length} طلب معرض`, actorId: actor.id, entityType: 'expo_applications', details: { ids: unique }, changes: removedChanges('expo_applications', rows, ['name', 'company', 'email', 'phone', 'message', 'adminNote']) });
    return { deleted: rows.length };
  }

  /** Public form. The same e-mail + kind can be sent once every 10 minutes (stops double clicks) — beyond that it is a new request. */
  async apply(dto: ApplyDto) {
    const email = dto.email.trim().toLowerCase();
    const since = new Date(Date.now() - 10 * 60_000);
    const dup = await this.apps.createQueryBuilder('a').where('a.email = :email AND a.kind = :kind AND a.createdAt > :since', { email, kind: dto.kind, since }).getCount();
    if (dup) return { message: 'تم استلام طلبك مسبقاً، سنتواصل معك قريباً' };
    const a = await this.apps.save(this.apps.create({ kind: dto.kind, status: 'new', name: dto.name.trim(), company: dto.company?.trim() || null, email, phone: dto.phone.trim(), sector: dto.sector?.trim() || null, message: dto.message?.trim() || null }));
    void this.notify(a);
    return { message: 'تم استلام طلبك بنجاح، سنتواصل معك قريباً' };
  }

  /** E-mail to the EXPO team (setting expo.contact_email, else the chamber's contact e-mail). Never fails the request. */
  private async notify(a: ExpoApplication) {
    try {
      const get = async (category: string, key: string) => ((await this.settings.findOne({ where: { category, key } }))?.value ?? '').toString().trim();
      const to = (await get('expo', 'contact_email')) || (await get('contact', 'email'));
      if (!to) return;
      const row = (k: string, v?: string | null) => (v ? `<p><b>${k}:</b> ${esc(v)}</p>` : '');
      const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h3>${KIND_AR[a.kind] ?? 'طلب جديد'} — DCC EXPO</h3>${row('الاسم', a.name)}${row('الشركة', a.company)}${row('البريد', a.email)}${row('الهاتف', a.phone)}${row('القطاع', a.sector)}${row('الرسالة', a.message)}</div>`;
      await this.mail.send(to, `${KIND_AR[a.kind] ?? 'طلب جديد'}: ${a.name}`, html);
    } catch (e) {
      this.logger.error(`Could not notify the EXPO team: ${(e as Error).message}`);
    }
  }
}
