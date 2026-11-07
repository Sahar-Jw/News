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
import { CC } from '../../common/content-categories';
import { ContentStore, Rec, isActive, pick, s, sortOf } from '../content/content.store';
import { filterByCf, matches, pageRows } from '../content/mem';
import { ApplicationsAdminQueryDto, ApplyDto, CreateExpoItemDto, ExpoItemsAdminQueryDto, UpdateApplicationDto, UpdateExpoItemDto } from './expo.dto';

const TEXT = ['nameEn', 'descriptionAr', 'descriptionEn', 'sectorAr', 'sectorEn', 'category', 'personAr', 'personEn', 'placeAr', 'placeEn', 'website'] as const;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** each expo kind is its own main category */
const EXPO_CODE: Record<string, string> = { exhibitor: CC.EXPO_EXHIBITOR, sponsor: CC.EXPO_SPONSOR, session: CC.EXPO_SESSION };
const EXPO_CODES = Object.values(EXPO_CODE);
const expoCode = (kind: string) => EXPO_CODE[kind];
const kindOfExpoCode = (code: string) => (Object.entries(EXPO_CODE).find(([, c]) => c === code)?.[0] ?? 'exhibitor') as 'exhibitor' | 'sponsor' | 'session';
const KIND_AR: Record<string, string> = { exhibitor: 'طلب مشاركة كعارض', visitor: 'تسجيل زائر', info: 'طلب معلومات' };

@Injectable()
export class ExpoService {
  private readonly logger = new Logger(ExpoService.name);

  constructor(
    private readonly store: ContentStore,
    @InjectRepository(ExpoApplication) private readonly apps: Repository<ExpoApplication>,
    @InjectRepository(SiteSetting) private readonly settings: Repository<SiteSetting>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------- items: admin
  /** exhibitors, sponsors and sessions: each kind is its own main category; name = news title, description = news body, logo = news image */
  private view(r: Rec) {
    const x = r.x;
    return {
      id: r.id, kind: kindOfExpoCode(r.code), nameAr: r.title, nameEn: s(x.nameEn), descriptionAr: r.body ?? '', descriptionEn: s(x.descriptionEn), sectorAr: s(x.sectorAr), sectorEn: s(x.sectorEn),
      category: s(x.category), personAr: s(x.personAr), personEn: s(x.personEn), placeAr: s(x.placeAr), placeEn: s(x.placeEn), website: s(x.website),
      startsAt: (x.startsAt ?? null) as string | null, endsAt: (x.endsAt ?? null) as string | null, sortOrder: sortOf(r), isActive: isActive(r), logo: r.images[0] ?? null,
    };
  }

  private presentAdmin(r: Rec) {
    const i = this.view(r);
    const out: Record<string, unknown> = {
      id: i.id, kind: i.kind, nameAr: i.nameAr, startsAt: i.startsAt ?? '', endsAt: i.endsAt ?? '', sortOrder: i.sortOrder, isActive: i.isActive, logoUrl: this.storage.url(i.logo), createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
    for (const f of TEXT) out[f] = (i as Record<string, any>)[f] ?? '';
    return out;
  }

  async list(q: ExpoItemsAdminQueryDto) {
    let rows = (await this.store.list(expoCode(q.kind))).map((r) => ({ r, v: this.view(r) }));
    if (q.q) rows = rows.filter(({ v }) => matches([v.nameAr, v.nameEn, v.sectorAr, v.personAr], q.q!));
    rows = filterByCf(rows, q.cf, { nameAr: (x) => [x.v.nameAr], nameEn: (x) => [x.v.nameEn], sectorAr: (x) => [x.v.sectorAr], category: (x) => [x.v.category], personAr: (x) => [x.v.personAr], placeAr: (x) => [x.v.placeAr] });
    const startKey = (v: { startsAt: string | null }) => (v.startsAt ? new Date(v.startsAt).getTime() : Infinity);
    rows.sort((a, b) => (q.kind === 'session' ? startKey(a.v) - startKey(b.v) : a.v.sortOrder - b.v.sortOrder) || a.v.nameAr.localeCompare(b.v.nameAr) || a.v.id - b.v.id);
    return pageRows(rows, q, (x) => this.presentAdmin(x.r));
  }

  private xOf(dto: UpdateExpoItemDto | CreateExpoItemDto, cur?: Rec) {
    const x: Record<string, any> = { sortOrder: dto.sortOrder === undefined ? undefined : dto.sortOrder ?? 0, isActive: dto.isActive };
    for (const f of TEXT) {
      if (f === 'descriptionAr') continue; // the Arabic description is the news body
      const v = (dto as any)[f];
      if (v !== undefined) x[f] = typeof v === 'string' ? v.trim() || null : null;
    }
    if (dto.startsAt !== undefined) x.startsAt = dto.startsAt ? new Date(dto.startsAt).toISOString() : null;
    if (dto.endsAt !== undefined) x.endsAt = dto.endsAt ? new Date(dto.endsAt).toISOString() : null;
    const start = x.startsAt !== undefined ? x.startsAt : cur?.x.startsAt ?? null;
    const end = x.endsAt !== undefined ? x.endsAt : cur?.x.endsAt ?? null;
    if (start && end && new Date(end) < new Date(start)) throw new BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية');
    return x;
  }
  private descriptionOf(dto: UpdateExpoItemDto | CreateExpoItemDto) {
    const v = (dto as any).descriptionAr;
    return v === undefined ? undefined : typeof v === 'string' ? v.trim() || null : null;
  }

  async create(dto: CreateExpoItemDto, logo: Express.Multer.File | undefined, actor: AuthUser) {
    const path = logo ? await this.storage.saveImage(logo, 'expo', 800) : null;
    try {
      const x = this.xOf(dto);
      const r = await this.store.create(expoCode(dto.kind), { title: dto.nameAr.trim(), body: this.descriptionOf(dto) ?? null, images: path ? [path] : [], x: { ...x, sortOrder: x.sortOrder ?? 0, isActive: x.isActive ?? true } });
      await this.audit.log({ category: 'expo', action: 'create', description: `إضافة إلى المعرض (${dto.kind}): ${r.title}`, actorId: actor.id, entityType: 'expo_items', entityId: r.id });
      return this.presentAdmin(r);
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }

  async update(id: number, dto: UpdateExpoItemDto, logo: Express.Multer.File | undefined, actor: AuthUser) {
    const cur = await this.store.get(id, EXPO_CODES);
    if (!cur) throw new NotFoundException('العنصر غير موجود');
    const newPath = logo ? await this.storage.saveImage(logo, 'expo', 800) : null;
    const oldPath = cur.images[0] ?? null;
    try {
      const r = await this.store.update(id, { title: dto.nameAr?.trim(), body: this.descriptionOf(dto), images: newPath ? [newPath] : dto.removeLogo ? [] : undefined, x: this.xOf(dto, cur) });
      if (oldPath && oldPath !== (r!.images[0] ?? null)) await this.storage.remove(oldPath);
      await this.audit.log({ category: 'expo', action: 'update', description: `تعديل في المعرض (${kindOfExpoCode(r!.code)}): ${r!.title}`, actorId: actor.id, entityType: 'expo_items', entityId: id });
      return this.presentAdmin(r!);
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
    const all = await this.store.list(EXPO_CODES);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض العناصر غير موجودة'); // nothing is deleted
    await this.store.remove(unique);
    await this.storage.removeMany(rows.map((r) => r.images[0] ?? null));
    await this.audit.log({ category: 'expo', action: 'delete', description: `حذف ${rows.length} عنصر من المعرض`, actorId: actor.id, entityType: 'expo_items', details: { ids: unique }, changes: removedChanges('expo_items', rows.map((r) => this.view(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- items: public
  /** Everything the EXPO site shows in one call (lists are small); the counters of the home page are computed here. */
  async publicAll(lang: 'ar' | 'en') {
    const en = lang === 'en';
    const rows = (await this.store.list(EXPO_CODES)).filter(isActive).map((r) => this.view(r)).sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr) || a.id - b.id).slice(0, 2000);
    const base = (i: (typeof rows)[number]) => ({ id: i.id, name: pick(i.nameAr, i.nameEn, en), description: pick(i.descriptionAr, i.descriptionEn, en), website: i.website || null, logoUrl: this.storage.url(i.logo) });
    const exhibitors = rows.filter((r) => r.kind === 'exhibitor').map((i) => ({ ...base(i), sector: pick(i.sectorAr, i.sectorEn, en), booth: pick(i.placeAr, i.placeEn, en) }));
    const sponsors = rows.filter((r) => r.kind === 'sponsor').map((i) => ({ ...base(i), tier: i.category || 'partner' }));
    const sessions = rows
      .filter((r) => r.kind === 'session')
      .sort((a, b) => (a.startsAt ? new Date(a.startsAt).getTime() : Infinity) - (b.startsAt ? new Date(b.startsAt).getTime() : Infinity))
      .map((i) => ({ ...base(i), type: i.category || 'other', startsAt: i.startsAt, endsAt: i.endsAt, hall: pick(i.placeAr, i.placeEn, en), speaker: pick(i.personAr, i.personEn, en) }));
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
