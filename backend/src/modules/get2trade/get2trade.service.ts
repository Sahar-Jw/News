import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike, sanitizeRichText } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { MailService } from '../mail/mail.service';
import { BookingDto, BookingsAdminQueryDto, CreatePackageDto, CreateSpaceDto, PackagesAdminQueryDto, SpacesAdminQueryDto, UpdateBookingDto, UpdateG2tSettingsDto, UpdatePackageDto, UpdateSpaceDto } from './get2trade.dto';
import { BookingStatus, G2tBooking, G2tPackage, G2tSpace, Get2TradeSettings, SpaceKind } from './get2trade.entity';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lines = (v: string | null | undefined) => (v ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
/** "G2T-2026-00042": shown to the applicant and used by the staff; derived from the id, nothing extra to store. */
export const reference = (b: { id: number; createdAt: Date }) => `G2T-${new Date(b.createdAt).getFullYear()}-${String(b.id).padStart(5, '0')}`;
/** the chamber works in Damascus time (same setting as the training center) */
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Asia/Damascus' });

const PACKAGE_TEXT = ['nameEn', 'featuresAr', 'featuresEn', 'priceAr', 'priceEn'] as const;
const SPACE_TEXT = ['nameEn', 'descriptionAr', 'descriptionEn', 'priceAr', 'priceEn'] as const;

@Injectable()
export class Get2TradeService {
  constructor(
    @InjectRepository(Get2TradeSettings) private readonly settingsRepo: Repository<Get2TradeSettings>,
    @InjectRepository(G2tPackage) private readonly packages: Repository<G2tPackage>,
    @InjectRepository(G2tSpace) private readonly spaces: Repository<G2tSpace>,
    @InjectRepository(G2tBooking) private readonly bookings: Repository<G2tBooking>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------- settings (page content)
  private async settingsRow() {
    return (await this.settingsRepo.findOne({ where: { id: 1 } })) ?? (await this.settingsRepo.save(this.settingsRepo.create({ id: 1, isOpen: true })));
  }

  getSettings() {
    return this.settingsRow();
  }

  async updateSettings(dto: UpdateG2tSettingsDto, actor: AuthUser) {
    const s = await this.settingsRow();
    for (const k of ['aboutAr', 'aboutEn', 'servicesAr', 'servicesEn'] as const) if (dto[k] !== undefined) s[k] = sanitizeRichText(dto[k]);
    for (const k of ['newsTopicAr', 'newsTopicEn', 'notifyEmail'] as const) if (dto[k] !== undefined) s[k] = dto[k]?.trim() || null;
    if (dto.isOpen !== undefined) s.isOpen = dto.isOpen;
    const saved = await this.settingsRepo.save(s);
    await this.audit.log({ category: 'get2trade', action: 'update', description: 'تعديل محتوى صفحة غيت تو تريد وإعداداتها', actorId: actor.id, entityType: 'g2t_settings', entityId: 1 });
    return saved;
  }

  // ---------------------------------------------------------------- admin: packages
  private presentPackage(p: G2tPackage) {
    return { id: Number(p.id), nameAr: p.nameAr, nameEn: p.nameEn ?? '', featuresAr: p.featuresAr ?? '', featuresEn: p.featuresEn ?? '', priceAr: p.priceAr ?? '', priceEn: p.priceEn ?? '', sortOrder: p.sortOrder, isActive: p.isActive };
  }

  async listPackages(q: PackagesAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.packages.createQueryBuilder('p');
    if (q.q) { const like = `%${escapeLike(q.q)}%`; qb.andWhere(new Brackets((b) => b.where('p.nameAr ILIKE :like', { like }).orWhere('p.nameEn ILIKE :like', { like }))); }
    applyColumnFilters(qb, q.cf, { nameAr: 'p.nameAr', nameEn: 'p.nameEn', priceAr: 'p.priceAr' });
    qb.orderBy('p.sortOrder', 'ASC').addOrderBy('p.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.presentPackage(r)), total, p);
  }

  private applyPackage(p: G2tPackage, dto: CreatePackageDto | UpdatePackageDto) {
    if (dto.nameAr !== undefined) p.nameAr = dto.nameAr.trim();
    for (const f of PACKAGE_TEXT) { const v = (dto as Record<string, any>)[f]; if (v !== undefined) p[f] = typeof v === 'string' ? v.trim() || null : null; }
    if (dto.sortOrder !== undefined) p.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) p.isActive = dto.isActive;
  }

  async createPackage(dto: CreatePackageDto, actor: AuthUser) {
    const p = this.packages.create({ sortOrder: 0, isActive: true });
    this.applyPackage(p, dto);
    const saved = await this.packages.save(p);
    await this.audit.log({ category: 'get2trade', action: 'create', description: `إضافة باقة: ${saved.nameAr}`, actorId: actor.id, entityType: 'g2t_packages', entityId: saved.id });
    return this.presentPackage(saved);
  }

  async updatePackage(id: number, dto: UpdatePackageDto, actor: AuthUser) {
    const p = await this.packages.findOne({ where: { id } });
    if (!p) throw new NotFoundException('الباقة غير موجودة');
    this.applyPackage(p, dto);
    const saved = await this.packages.save(p);
    await this.audit.log({ category: 'get2trade', action: 'update', description: `تعديل باقة: ${saved.nameAr}`, actorId: actor.id, entityType: 'g2t_packages', entityId: id });
    return this.presentPackage(saved);
  }

  async removePackages(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.packages.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الباقات غير موجودة'); // nothing is deleted
    await this.packages.delete({ id: In(unique) }); // bookings keep existing, without the package (ON DELETE SET NULL)
    await this.audit.log({ category: 'get2trade', action: 'delete', description: `حذف ${rows.length} باقة`, actorId: actor.id, entityType: 'g2t_packages', details: { ids: unique }, changes: removedChanges('g2t_packages', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- admin: spaces
  private presentSpace(s: G2tSpace) {
    const out: Record<string, unknown> = { id: Number(s.id), kind: s.kind, nameAr: s.nameAr, capacity: s.capacity, areaSqm: s.areaSqm, sortOrder: s.sortOrder, isAvailable: s.isAvailable, isActive: s.isActive, imageUrl: this.storage.url(s.image) };
    for (const f of SPACE_TEXT) out[f] = s[f] ?? '';
    return out;
  }

  async listSpaces(q: SpacesAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.spaces.createQueryBuilder('s');
    if (q.kind) qb.andWhere('s.kind = :kind', { kind: q.kind });
    if (q.q) { const like = `%${escapeLike(q.q)}%`; qb.andWhere(new Brackets((b) => b.where('s.nameAr ILIKE :like', { like }).orWhere('s.nameEn ILIKE :like', { like }))); }
    applyColumnFilters(qb, q.cf, { nameAr: 's.nameAr', nameEn: 's.nameEn', priceAr: 's.priceAr' });
    qb.orderBy('s.sortOrder', 'ASC').addOrderBy('s.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.presentSpace(r)), total, p);
  }

  private applySpace(s: G2tSpace, dto: CreateSpaceDto | UpdateSpaceDto) {
    if (dto.kind !== undefined) s.kind = dto.kind as SpaceKind;
    if (dto.nameAr !== undefined) s.nameAr = dto.nameAr.trim();
    for (const f of SPACE_TEXT) { const v = (dto as Record<string, any>)[f]; if (v !== undefined) s[f] = typeof v === 'string' ? v.trim() || null : null; }
    if (dto.capacity !== undefined) s.capacity = dto.capacity ?? null;
    if (dto.areaSqm !== undefined) s.areaSqm = dto.areaSqm ?? null;
    if (dto.sortOrder !== undefined) s.sortOrder = dto.sortOrder ?? 0;
    if (dto.isAvailable !== undefined) s.isAvailable = dto.isAvailable;
    if (dto.isActive !== undefined) s.isActive = dto.isActive;
  }

  async createSpace(dto: CreateSpaceDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const path = image ? await this.storage.saveImage(image, 'get2trade', 1200) : null;
    try {
      const s = this.spaces.create({ image: path, isActive: true, isAvailable: true, sortOrder: 0 });
      this.applySpace(s, dto);
      const saved = await this.spaces.save(s);
      await this.audit.log({ category: 'get2trade', action: 'create', description: `إضافة مساحة: ${saved.nameAr}`, actorId: actor.id, entityType: 'g2t_spaces', entityId: saved.id });
      return this.presentSpace(saved);
    } catch (e) {
      await this.storage.remove(path); // nothing saved: do not leave an orphan file
      throw e;
    }
  }

  async updateSpace(id: number, dto: UpdateSpaceDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const s = await this.spaces.findOne({ where: { id } });
    if (!s) throw new NotFoundException('المساحة غير موجودة');
    const newPath = image ? await this.storage.saveImage(image, 'get2trade', 1200) : null;
    const oldPath = s.image;
    try {
      this.applySpace(s, dto);
      if (newPath) s.image = newPath;
      else if (dto.removeImage) s.image = null;
      const saved = await this.spaces.save(s);
      await this.audit.log({ category: 'get2trade', action: 'update', description: `تعديل مساحة: ${saved.nameAr}`, actorId: actor.id, entityType: 'g2t_spaces', entityId: id });
      if (oldPath && oldPath !== saved.image) await this.storage.remove(oldPath);
      return this.presentSpace(saved);
    } catch (e) {
      await this.storage.remove(newPath);
      throw e;
    }
  }

  async removeSpaces(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.spaces.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض المساحات غير موجودة'); // nothing is deleted
    await this.spaces.delete({ id: In(unique) }); // bookings keep existing, without the space (ON DELETE SET NULL)
    await this.storage.removeMany(rows.map((r) => r.image));
    await this.audit.log({ category: 'get2trade', action: 'delete', description: `حذف ${rows.length} مساحة`, actorId: actor.id, entityType: 'g2t_spaces', details: { ids: unique }, changes: removedChanges('g2t_spaces', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public page
  async publicPage(lang: string) {
    const en = lang === 'en';
    const pick = (ar: string | null, e: string | null) => (en && e) || ar || '';
    const [s, pk, sp] = await Promise.all([
      this.settingsRow(),
      this.packages.find({ where: { isActive: true }, order: { sortOrder: 'ASC', id: 'ASC' } }),
      this.spaces.find({ where: { isActive: true }, order: { sortOrder: 'ASC', id: 'ASC' } }),
    ]);
    return {
      isOpen: s.isOpen, about: pick(s.aboutAr, s.aboutEn), services: pick(s.servicesAr, s.servicesEn), newsTopic: pick(s.newsTopicAr, s.newsTopicEn),
      packages: pk.map((p) => ({ id: Number(p.id), name: pick(p.nameAr, p.nameEn), features: lines(en && p.featuresEn ? p.featuresEn : p.featuresAr), price: pick(p.priceAr, p.priceEn) })),
      spaces: sp.map((x) => ({ id: Number(x.id), kind: x.kind, name: pick(x.nameAr, x.nameEn), description: pick(x.descriptionAr, x.descriptionEn), capacity: x.capacity, areaSqm: x.areaSqm, price: pick(x.priceAr, x.priceEn), isAvailable: x.isAvailable, imageUrl: this.storage.url(x.image) })),
    };
  }

  // ---------------------------------------------------------------- public: booking / inquiry
  async book(dto: BookingDto) {
    const s = await this.settingsRow();
    if (dto.kind === 'booking' && !s.isOpen) throw new BadRequestException('باب الحجز مغلق حالياً، يمكنك إرسال استفسار');
    if (dto.kind === 'inquiry' && (dto.message ?? '').trim().length < 5) throw new BadRequestException('اكتب نص الاستفسار');
    if (dto.startDate && dto.startDate < todayStr()) throw new BadRequestException('تاريخ بدء الحجز لا يمكن أن يكون في الماضي');
    let space: G2tSpace | null = null;
    let pack: G2tPackage | null = null;
    if (dto.spaceId) {
      space = await this.spaces.findOne({ where: { id: dto.spaceId, isActive: true } });
      if (!space) throw new BadRequestException('المساحة غير موجودة');
      if (dto.kind === 'booking' && !space.isAvailable) throw new BadRequestException('هذه المساحة غير متاحة حالياً');
      if (dto.people && space.capacity && dto.people > space.capacity) throw new BadRequestException(`سعة هذه المساحة ${space.capacity} أشخاص`);
    }
    if (dto.packageId) {
      pack = await this.packages.findOne({ where: { id: dto.packageId, isActive: true } });
      if (!pack) throw new BadRequestException('الباقة غير موجودة');
    }
    // one open request per e-mail and space: stops duplicates and flooding
    const open = await this.bookings.findOne({ where: { email: dto.email, spaceId: space ? space.id : (null as any), status: In(['new', 'in_review']) } });
    if (open) throw new ConflictException('لديك طلب قيد المعالجة بهذا البريد لنفس المساحة');
    const b = await this.bookings.save(this.bookings.create({
      kind: dto.kind as 'booking' | 'inquiry', spaceId: space?.id ?? null, packageId: pack?.id ?? null, name: dto.name, company: dto.company ?? null, phone: dto.phone, email: dto.email,
      startDate: dto.startDate ?? null, people: dto.people ?? null, message: dto.message ?? null, status: 'new',
    }));
    const ref = reference(b);
    const what = dto.kind === 'booking' ? 'طلب حجز جديد' : 'استفسار جديد';
    await this.audit.log({ category: 'get2trade', action: 'create', description: `${what} ${ref}`, entityType: 'g2t_bookings', entityId: b.id });
    if (s.notifyEmail) {
      const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h3>${what} ${ref}</h3>`
        + `<p><b>الاسم:</b> ${esc(dto.name)}<br>${dto.company ? `<b>الشركة:</b> ${esc(dto.company)}<br>` : ''}<b>الهاتف:</b> ${esc(dto.phone)}<br><b>البريد:</b> ${esc(dto.email)}`
        + `${space ? `<br><b>المساحة:</b> ${esc(space.nameAr)}` : ''}${pack ? `<br><b>الباقة:</b> ${esc(pack.nameAr)}` : ''}${dto.startDate ? `<br><b>تاريخ البدء:</b> ${esc(dto.startDate)}` : ''}${dto.people ? `<br><b>عدد الأشخاص:</b> ${dto.people}` : ''}</p>`
        + `${dto.message ? `<p style="white-space:pre-wrap">${esc(dto.message)}</p>` : ''}</div>`;
      void this.mail.send(s.notifyEmail, `${what} ${ref}`, html);
    }
    void this.mail.send(dto.email, 'استلمنا طلبك', `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><p>شكراً لك ${esc(dto.name)}، استلمنا طلبك في غيت تو تريد. رقم الطلب: <b>${ref}</b>. سنتواصل معك قريباً.</p></div>`);
    return { id: Number(b.id), reference: ref, message: 'تم استلام طلبك' };
  }

  // ---------------------------------------------------------------- admin: bookings
  private presentBooking(b: G2tBooking) {
    return { ...b, id: Number(b.id), reference: reference(b), spaceName: b.space?.nameAr ?? '', packageName: b.package?.nameAr ?? '' };
  }

  private buildBookings(q: BookingsAdminQueryDto) {
    const qb = this.bookings.createQueryBuilder('b').leftJoinAndSelect('b.space', 's').leftJoinAndSelect('b.package', 'p');
    if (q.status) qb.andWhere('b.status = :st', { st: q.status });
    if (q.kind) qb.andWhere('b.kind = :kind', { kind: q.kind });
    if (q.from) qb.andWhere('b.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('b.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) { const like = `%${escapeLike(q.q)}%`; qb.andWhere(new Brackets((x) => x.where('b.name ILIKE :like', { like }).orWhere('b.company ILIKE :like', { like }).orWhere('b.email ILIKE :like', { like }).orWhere('b.phone ILIKE :like', { like }).orWhere('s.nameAr ILIKE :like', { like }))); }
    applyColumnFilters(qb, q.cf, { name: 'b.name', company: 'b.company', email: 'b.email', phone: 'b.phone', spaceName: 's.nameAr', packageName: 'p.nameAr', createdAt: 'CAST(b.createdAt AS TEXT)' });
    return qb.orderBy('b.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('b.id', 'DESC');
  }

  async listBookings(q: BookingsAdminQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.buildBookings(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.presentBooking(r)), total, p);
  }

  async allBookings(q: BookingsAdminQueryDto) {
    return (await this.buildBookings(q).take(10000).getMany()).map((r) => this.presentBooking(r));
  }

  async oneBooking(id: number) {
    const b = await this.bookings.findOne({ where: { id }, relations: { space: true, package: true } });
    if (!b) throw new NotFoundException('الطلب غير موجود');
    return this.presentBooking(b);
  }

  async updateBooking(id: number, dto: UpdateBookingDto, actor: AuthUser) {
    const b = await this.bookings.findOne({ where: { id }, relations: { space: true, package: true } });
    if (!b) throw new NotFoundException('الطلب غير موجود');
    const before = b.status;
    if (dto.status !== undefined) b.status = dto.status as BookingStatus;
    if (dto.staffNotes !== undefined) b.staffNotes = dto.staffNotes?.trim() || null;
    const saved = await this.bookings.save(b);
    await this.audit.log({ category: 'get2trade', action: 'update', description: `تحديث الطلب ${reference(saved)} (${saved.status})`, actorId: actor.id, entityType: 'g2t_bookings', entityId: id });
    if (before !== saved.status && (saved.status === 'accepted' || saved.status === 'rejected')) {
      const ok = saved.status === 'accepted';
      void this.mail.send(saved.email, ok ? 'تم تأكيد طلبك في غيت تو تريد' : 'بخصوص طلبك في غيت تو تريد',
        `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><p>${ok ? 'يسرّنا إبلاغكم بتأكيد طلبكم' : 'نأسف لإبلاغكم بتعذّر تلبية طلبكم حالياً'} (${reference(saved)}).</p></div>`);
    }
    return this.presentBooking(saved);
  }

  async removeBookings(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.bookings.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الطلبات غير موجودة'); // nothing is deleted
    await this.bookings.delete({ id: In(unique) });
    // the applicants' personal data is not copied into the audit log
    await this.audit.log({ category: 'get2trade', action: 'delete', description: `حذف ${rows.length} من طلبات غيت تو تريد`, actorId: actor.id, entityType: 'g2t_bookings', details: { ids: unique }, changes: removedChanges('g2t_bookings', rows, ['name', 'company', 'phone', 'email', 'message', 'staffNotes']) });
    return { deleted: rows.length };
  }
}
