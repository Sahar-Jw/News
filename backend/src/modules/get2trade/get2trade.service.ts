import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { dayEnd, dayStart } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike, sanitizeRichText } from '../../common/utils/text';
import { CC } from '../../common/content-categories';
import { ContentStore, Rec, isActive, pick, s, sortOf } from '../content/content.store';
import { by, filterByCf, matches, pageRows } from '../content/mem';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { MailService } from '../mail/mail.service';
import { BookingDto, BookingsAdminQueryDto, CreatePackageDto, CreateSpaceDto, PackagesAdminQueryDto, SpacesAdminQueryDto, UpdateBookingDto, UpdateG2tSettingsDto, UpdatePackageDto, UpdateSpaceDto } from './get2trade.dto';
import { BookingStatus, DurationUnit, G2tBooking, Get2TradeSettings, SpaceKind } from './get2trade.entity';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const lines = (v: string | null | undefined) => (v ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
/** "G2T-2026-00042": shown to the applicant and used by the staff; derived from the id, nothing extra to store. */
export const reference = (b: { id: number; createdAt: Date }) => `G2T-${new Date(b.createdAt).getFullYear()}-${String(b.id).padStart(5, '0')}`;
/** the chamber works in Damascus time (same setting as the training center) */
const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Asia/Damascus' });

const UNIT_AR: Record<string, string> = { day: 'يوم', week: 'أسبوع', month: 'شهر', year: 'سنة' };
const KIND_AR: Record<string, string> = { office: 'مكتب مجهز', coworking: 'مساحة عمل مشتركة', meeting_room: 'قاعة اجتماعات', other: 'أخرى' };

const PACKAGE_TEXT = ['nameEn', 'featuresAr', 'featuresEn', 'priceAr', 'priceEn'] as const;
const SPACE_TEXT = ['nameEn', 'descriptionAr', 'descriptionEn', 'priceAr', 'priceEn'] as const;

@Injectable()
export class Get2TradeService {
  constructor(
    @InjectRepository(Get2TradeSettings) private readonly settingsRepo: Repository<Get2TradeSettings>,
    private readonly store: ContentStore,
    @InjectRepository(G2tBooking) private readonly bookings: Repository<G2tBooking>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------- settings (page content)
  /** the page texts: one news row (main category G2T_INFO), created on first use */
  private async infoRec(): Promise<Rec> {
    const hit = (await this.store.list(CC.G2T_INFO))[0];
    return hit ?? (await this.store.create(CC.G2T_INFO, { title: 'Get2Trade', body: null, x: {} }));
  }

  private async settingsRow() {
    return (await this.settingsRepo.findOne({ where: { id: 1 } })) ?? (await this.settingsRepo.save(this.settingsRepo.create({ id: 1, isOpen: true })));
  }

  /** texts (news row) + notify e-mail / open flag (settings row) in the shape the admin form always had */
  private async merged() {
    const [i, st] = await Promise.all([this.infoRec(), this.settingsRow()]);
    return {
      id: 1, aboutAr: i.body ?? null, aboutEn: (i.x.aboutEn ?? null) as string | null, servicesAr: (i.x.servicesAr ?? null) as string | null, servicesEn: (i.x.servicesEn ?? null) as string | null,
      newsTopicAr: (i.x.newsTopicAr ?? null) as string | null, newsTopicEn: (i.x.newsTopicEn ?? null) as string | null, notifyEmail: st.notifyEmail, isOpen: st.isOpen,
      createdAt: i.createdAt, updatedAt: st.updatedAt > i.updatedAt ? st.updatedAt : i.updatedAt,
    };
  }

  getSettings() {
    return this.merged();
  }

  async updateSettings(dto: UpdateG2tSettingsDto, actor: AuthUser) {
    const i = await this.infoRec();
    const x: Record<string, any> = {};
    if (dto.aboutEn !== undefined) x.aboutEn = sanitizeRichText(dto.aboutEn);
    if (dto.servicesAr !== undefined) x.servicesAr = sanitizeRichText(dto.servicesAr);
    if (dto.servicesEn !== undefined) x.servicesEn = sanitizeRichText(dto.servicesEn);
    for (const k of ['newsTopicAr', 'newsTopicEn'] as const) if (dto[k] !== undefined) x[k] = dto[k]?.trim() || null;
    await this.store.update(i.id, { body: dto.aboutAr === undefined ? undefined : sanitizeRichText(dto.aboutAr), x });
    const st = await this.settingsRow();
    if (dto.notifyEmail !== undefined) st.notifyEmail = dto.notifyEmail?.trim() || null;
    if (dto.isOpen !== undefined) st.isOpen = dto.isOpen;
    await this.settingsRepo.save(st);
    await this.audit.log({ category: 'get2trade', action: 'update', description: 'تعديل محتوى صفحة غيت تو تريد وإعداداتها', actorId: actor.id, entityType: 'g2t_settings', entityId: 1 });
    return this.merged();
  }

  // ---------------------------------------------------------------- admin: packages
  private presentPackage(r: Rec) {
    return { id: r.id, nameAr: r.title, nameEn: s(r.x.nameEn), featuresAr: s(r.x.featuresAr), featuresEn: s(r.x.featuresEn), priceAr: s(r.x.priceAr), priceEn: s(r.x.priceEn), sortOrder: sortOf(r), isActive: isActive(r) };
  }

  async listPackages(q: PackagesAdminQueryDto) {
    let rows = (await this.store.list(CC.G2T_PACKAGE)).map((r) => this.presentPackage(r));
    if (q.q) rows = rows.filter((p) => matches([p.nameAr, p.nameEn], q.q!));
    rows = filterByCf(rows, q.cf, { nameAr: (p) => [p.nameAr], nameEn: (p) => [p.nameEn], priceAr: (p) => [p.priceAr] });
    rows.sort(by((p) => p.sortOrder, (p) => p.id));
    return pageRows(rows, q, (p) => p);
  }

  private packageX(dto: CreatePackageDto | UpdatePackageDto) {
    const x: Record<string, any> = { sortOrder: dto.sortOrder, isActive: dto.isActive };
    for (const f of PACKAGE_TEXT) { const v = (dto as Record<string, any>)[f]; if (v !== undefined) x[f] = typeof v === 'string' ? v.trim() || null : null; }
    return x;
  }

  async createPackage(dto: CreatePackageDto, actor: AuthUser) {
    const x = this.packageX(dto);
    const r = await this.store.create(CC.G2T_PACKAGE, { title: dto.nameAr.trim(), x: { ...x, sortOrder: x.sortOrder ?? 0, isActive: x.isActive ?? true } });
    await this.audit.log({ category: 'get2trade', action: 'create', description: `إضافة باقة: ${r.title}`, actorId: actor.id, entityType: 'g2t_packages', entityId: r.id });
    return this.presentPackage(r);
  }

  async updatePackage(id: number, dto: UpdatePackageDto, actor: AuthUser) {
    if (!(await this.store.get(id, CC.G2T_PACKAGE))) throw new NotFoundException('الباقة غير موجودة');
    const r = await this.store.update(id, { title: dto.nameAr?.trim(), x: this.packageX(dto) });
    await this.audit.log({ category: 'get2trade', action: 'update', description: `تعديل باقة: ${r!.title}`, actorId: actor.id, entityType: 'g2t_packages', entityId: id });
    return this.presentPackage(r!);
  }

  async removePackages(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(CC.G2T_PACKAGE);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض الباقات غير موجودة'); // nothing is deleted
    await this.store.remove(unique); // bookings keep existing, without the package (ON DELETE SET NULL)
    await this.audit.log({ category: 'get2trade', action: 'delete', description: `حذف ${rows.length} باقة`, actorId: actor.id, entityType: 'g2t_packages', details: { ids: unique }, changes: removedChanges('g2t_packages', rows.map((r) => this.presentPackage(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- admin: spaces
  private spaceView(r: Rec) {
    return {
      id: r.id, kind: (r.x.kind ?? 'office') as SpaceKind, nameAr: r.title, nameEn: s(r.x.nameEn), descriptionAr: r.body ?? '', descriptionEn: s(r.x.descriptionEn), priceAr: s(r.x.priceAr), priceEn: s(r.x.priceEn),
      capacity: (r.x.capacity ?? null) as number | null, areaSqm: (r.x.areaSqm ?? null) as number | null, sortOrder: sortOf(r), isAvailable: r.x.isAvailable !== false, isActive: isActive(r), image: r.images[0] ?? null,
    };
  }
  private presentSpace(r: Rec) {
    const v = this.spaceView(r);
    return {
      id: v.id, kind: v.kind, nameAr: v.nameAr, capacity: v.capacity, areaSqm: v.areaSqm, sortOrder: v.sortOrder, isAvailable: v.isAvailable, isActive: v.isActive, imageUrl: this.storage.url(v.image),
      nameEn: v.nameEn, descriptionAr: v.descriptionAr, descriptionEn: v.descriptionEn, priceAr: v.priceAr, priceEn: v.priceEn,
    };
  }

  async listSpaces(q: SpacesAdminQueryDto) {
    let rows = (await this.store.list(CC.G2T_SPACE)).map((r) => ({ r, v: this.spaceView(r) }));
    if (q.kind) rows = rows.filter(({ v }) => v.kind === q.kind);
    if (q.q) rows = rows.filter(({ v }) => matches([v.nameAr, v.nameEn], q.q!));
    rows = filterByCf(rows, q.cf, { nameAr: (x) => [x.v.nameAr], nameEn: (x) => [x.v.nameEn], priceAr: (x) => [x.v.priceAr] });
    rows.sort(by((x) => x.v.sortOrder, (x) => x.v.id));
    return pageRows(rows, q, (x) => this.presentSpace(x.r));
  }

  private spaceX(dto: CreateSpaceDto | UpdateSpaceDto) {
    const x: Record<string, any> = {
      kind: dto.kind, capacity: dto.capacity === undefined ? undefined : dto.capacity ?? null, areaSqm: dto.areaSqm === undefined ? undefined : dto.areaSqm ?? null,
      sortOrder: dto.sortOrder === undefined ? undefined : dto.sortOrder ?? 0, isAvailable: dto.isAvailable, isActive: dto.isActive,
    };
    for (const f of SPACE_TEXT) { if (f === 'descriptionAr') continue; const v = (dto as Record<string, any>)[f]; if (v !== undefined) x[f] = typeof v === 'string' ? v.trim() || null : null; }
    return x;
  }
  private spaceBody(dto: CreateSpaceDto | UpdateSpaceDto) {
    const v = (dto as Record<string, any>).descriptionAr;
    return v === undefined ? undefined : typeof v === 'string' ? v.trim() || null : null;
  }

  async createSpace(dto: CreateSpaceDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const path = image ? await this.storage.saveImage(image, 'get2trade', 1200) : null;
    try {
      const x = this.spaceX(dto);
      const r = await this.store.create(CC.G2T_SPACE, { title: dto.nameAr.trim(), body: this.spaceBody(dto) ?? null, images: path ? [path] : [], x: { ...x, kind: x.kind ?? 'office', isAvailable: x.isAvailable ?? true, isActive: x.isActive ?? true, sortOrder: x.sortOrder ?? 0 } });
      await this.audit.log({ category: 'get2trade', action: 'create', description: `إضافة مساحة: ${r.title}`, actorId: actor.id, entityType: 'g2t_spaces', entityId: r.id });
      return this.presentSpace(r);
    } catch (e) {
      await this.storage.remove(path); // nothing saved: do not leave an orphan file
      throw e;
    }
  }

  async updateSpace(id: number, dto: UpdateSpaceDto, image: Express.Multer.File | undefined, actor: AuthUser) {
    const cur = await this.store.get(id, CC.G2T_SPACE);
    if (!cur) throw new NotFoundException('المساحة غير موجودة');
    const newPath = image ? await this.storage.saveImage(image, 'get2trade', 1200) : null;
    const oldPath = cur.images[0] ?? null;
    try {
      const r = await this.store.update(id, { title: dto.nameAr?.trim(), body: this.spaceBody(dto), images: newPath ? [newPath] : dto.removeImage ? [] : undefined, x: this.spaceX(dto) });
      await this.audit.log({ category: 'get2trade', action: 'update', description: `تعديل مساحة: ${r!.title}`, actorId: actor.id, entityType: 'g2t_spaces', entityId: id });
      if (oldPath && oldPath !== (r!.images[0] ?? null)) await this.storage.remove(oldPath);
      return this.presentSpace(r!);
    } catch (e) {
      await this.storage.remove(newPath);
      throw e;
    }
  }

  async removeSpaces(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(CC.G2T_SPACE);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض المساحات غير موجودة'); // nothing is deleted
    await this.store.remove(unique); // bookings keep existing, without the space (ON DELETE SET NULL)
    await this.storage.removeMany(rows.map((r) => r.images[0] ?? null));
    await this.audit.log({ category: 'get2trade', action: 'delete', description: `حذف ${rows.length} مساحة`, actorId: actor.id, entityType: 'g2t_spaces', details: { ids: unique }, changes: removedChanges('g2t_spaces', rows.map((r) => this.spaceView(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public page
  async publicPage(lang: string) {
    const en = lang === 'en';
    const [m, pk, sp] = await Promise.all([
      this.merged(),
      this.store.list(CC.G2T_PACKAGE),
      this.store.list(CC.G2T_SPACE),
    ]);
    return {
      isOpen: m.isOpen, about: pick(m.aboutAr, m.aboutEn, en), services: pick(m.servicesAr, m.servicesEn, en), newsTopic: pick(m.newsTopicAr, m.newsTopicEn, en),
      packages: pk.filter(isActive).sort(by((r) => sortOf(r), (r) => r.id)).map((p) => ({ id: p.id, name: pick(p.title, p.x.nameEn, en), features: lines(en && p.x.featuresEn ? p.x.featuresEn : p.x.featuresAr), price: pick(p.x.priceAr, p.x.priceEn, en) })),
      spaces: sp.filter(isActive).sort(by((r) => sortOf(r), (r) => r.id)).map((x) => ({ id: x.id, kind: x.x.kind ?? 'office', name: pick(x.title, x.x.nameEn, en), description: pick(x.body, x.x.descriptionEn, en), capacity: x.x.capacity ?? null, areaSqm: x.x.areaSqm ?? null, price: pick(x.x.priceAr, x.x.priceEn, en), isAvailable: x.x.isAvailable !== false, imageUrl: this.storage.url(x.images[0] ?? null) })),
    };
  }

  // ---------------------------------------------------------------- public: booking / inquiry
  async book(dto: BookingDto) {
    const st = await this.settingsRow();
    if (dto.kind === 'booking' && !st.isOpen) throw new BadRequestException('باب الحجز مغلق حالياً، يمكنك إرسال استفسار');
    if (dto.kind === 'inquiry' && (dto.message ?? '').trim().length < 5) throw new BadRequestException('اكتب نص الاستفسار');
    if (dto.kind === 'booking' && (dto.name.match(/\S+/g) ?? []).length < 3) throw new BadRequestException('اكتب الاسم الثلاثي');
    if (!!dto.durationValue !== !!dto.durationUnit) throw new BadRequestException('حدد مدة الحجز (الرقم والوحدة)');
    if (dto.startDate && dto.startDate < todayStr()) throw new BadRequestException('تاريخ بدء الحجز لا يمكن أن يكون في الماضي');
    let space: ReturnType<Get2TradeService['spaceView']> | null = null;
    let pack: ReturnType<Get2TradeService['presentPackage']> | null = null;
    if (dto.spaceId) {
      const r = await this.store.get(dto.spaceId, CC.G2T_SPACE);
      space = r && isActive(r) ? this.spaceView(r) : null;
      if (!space) throw new BadRequestException('المساحة غير موجودة');
      if (dto.kind === 'booking' && !space.isAvailable) throw new BadRequestException('هذه المساحة غير متاحة حالياً');
      if (dto.people && space.capacity && dto.people > space.capacity) throw new BadRequestException(`سعة هذه المساحة ${space.capacity} أشخاص`);
    }
    if (dto.packageId) {
      const r = await this.store.get(dto.packageId, CC.G2T_PACKAGE);
      pack = r && isActive(r) ? this.presentPackage(r) : null;
      if (!pack) throw new BadRequestException('الباقة غير موجودة');
    }
    // one open request per e-mail and space: stops duplicates and flooding
    const open = await this.bookings.findOne({ where: { email: dto.email, spaceId: space ? space.id : (null as any), status: In(['new', 'in_review']) } });
    if (open) throw new ConflictException('لديك طلب قيد المعالجة بهذا البريد لنفس المساحة');
    const b = await this.bookings.save(this.bookings.create({
      kind: dto.kind as 'booking' | 'inquiry', spaceId: space?.id ?? null, packageId: pack?.id ?? null, name: dto.name, company: dto.company ?? null, phone: dto.phone, email: dto.email,
      startDate: dto.startDate ?? null, people: dto.people ?? null, message: dto.message ?? null, status: 'new',
      spaceKind: (space?.kind ?? dto.spaceKind ?? null) as SpaceKind | null, durationValue: dto.durationValue ?? null, durationUnit: (dto.durationUnit ?? null) as DurationUnit | null, extraServices: dto.extraServices ?? null,
    }));
    const ref = reference(b);
    const what = dto.kind === 'booking' ? 'طلب حجز جديد' : 'استفسار جديد';
    await this.audit.log({ category: 'get2trade', action: 'create', description: `${what} ${ref}`, entityType: 'g2t_bookings', entityId: b.id });
    if (st.notifyEmail) {
      const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h3>${what} ${ref}</h3>`
        + `<p><b>الاسم:</b> ${esc(dto.name)}<br>${dto.company ? `<b>الشركة:</b> ${esc(dto.company)}<br>` : ''}<b>الهاتف:</b> ${esc(dto.phone)}<br><b>البريد:</b> ${esc(dto.email)}`
        + `${space ? `<br><b>المساحة:</b> ${esc(space.nameAr)}` : ''}${pack ? `<br><b>الباقة:</b> ${esc(pack.nameAr)}` : ''}${dto.startDate ? `<br><b>تاريخ البدء:</b> ${esc(dto.startDate)}` : ''}${dto.people ? `<br><b>عدد الأشخاص:</b> ${dto.people}` : ''}${b.spaceKind ? `<br><b>نوع المساحة:</b> ${KIND_AR[b.spaceKind] ?? esc(b.spaceKind)}` : ''}${b.durationValue && b.durationUnit ? `<br><b>مدة الحجز:</b> ${b.durationValue} ${UNIT_AR[b.durationUnit] ?? ''}` : ''}${dto.extraServices ? `<br><b>خدمات إضافية:</b> ${esc(dto.extraServices)}` : ''}</p>`
        + `${dto.message ? `<p style="white-space:pre-wrap">${esc(dto.message)}</p>` : ''}</div>`;
      void this.mail.as('get2trade').send(st.notifyEmail, `${what} ${ref}`, html);
    }
    void this.mail.as('get2trade').send(dto.email, 'استلمنا طلبك', `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><p>شكراً لك ${esc(dto.name)}، استلمنا طلبك في غيت تو تريد. رقم الطلب: <b>${ref}</b>. سنتواصل معك قريباً.</p></div>`);
    return { id: Number(b.id), reference: ref, message: 'تم استلام طلبك' };
  }

  // ---------------------------------------------------------------- admin: bookings
  private presentBooking(b: G2tBooking) {
    const { space, package: pack, ...rest } = b;
    return { ...rest, id: Number(b.id), reference: reference(b), spaceName: space?.title ?? '', packageName: pack?.title ?? '' };
  }

  private buildBookings(q: BookingsAdminQueryDto) {
    const qb = this.bookings.createQueryBuilder('b').leftJoinAndSelect('b.space', 's').leftJoinAndSelect('b.package', 'p');
    if (q.status) qb.andWhere('b.status = :st', { st: q.status });
    if (q.kind) qb.andWhere('b.kind = :kind', { kind: q.kind });
    if (q.from) qb.andWhere('b.createdAt >= :from', { from: dayStart(q.from) });
    if (q.to) qb.andWhere('b.createdAt <= :to', { to: dayEnd(q.to) });
    if (q.q) { const like = `%${escapeLike(q.q)}%`; qb.andWhere(new Brackets((x) => x.where('b.name ILIKE :like', { like }).orWhere('b.company ILIKE :like', { like }).orWhere('b.email ILIKE :like', { like }).orWhere('b.phone ILIKE :like', { like }).orWhere('s.title ILIKE :like', { like }))); }
    applyColumnFilters(qb, q.cf, { name: 'b.name', company: 'b.company', email: 'b.email', phone: 'b.phone', spaceName: 's.title', packageName: 'p.title', createdAt: 'CAST(b.createdAt AS TEXT)' });
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
      void this.mail.as('get2trade').send(saved.email, ok ? 'تم تأكيد طلبك في غيت تو تريد' : 'بخصوص طلبك في غيت تو تريد',
        `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><p>${ok ? 'يسرّنا إبلاغكم بتأكيد طلبكم' : 'نأسف لإبلاغكم بتعذّر تلبية طلبكم حالياً'} (${reference(saved)}).${ok ? ' سنتواصل معكم قريباً لاستكمال التفاصيل.' : ''}</p></div>`);
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
