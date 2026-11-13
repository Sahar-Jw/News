import { Injectable, NotFoundException } from '@nestjs/common';
import { CC } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { ContentStore, Rec, isActive, pick, s, sortOf } from '../content/content.store';
import { by, filterByCf, matches, pageRows } from '../content/mem';
import { FileStorageService } from '../files/file-storage.service';
import { ServiceKind } from './service.entity';
import type { ServiceFiles } from './services.controller';
import { CreateServiceDto, PublicServicesQueryDto, ServicesAdminQueryDto, UpdateServiceDto } from './services.dto';

/** text fields the admin form edits that live in `extra` (the Arabic description is the news body) */
const X_TEXT_FIELDS = [
  'nameEn', 'descriptionEn', 'audienceAr', 'audienceEn', 'documentsAr', 'documentsEn', 'stepsAr', 'stepsEn',
  'locationAr', 'locationEn', 'departmentAr', 'departmentEn', 'departmentUrl', 'durationAr', 'durationEn', 'feeAr', 'feeEn', 'formUrl',
] as const;

const lines = (v: string | null | undefined) => (v ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

/** Chamber services (the one-stop window): news rows of the main category SERVICE. Name = news title, description = news body, picture = news image. */
@Injectable()
export class ServicesService {
  constructor(
    private readonly store: ContentStore,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
  ) {}

  private view(r: Rec) {
    const out: Record<string, any> = { id: r.id, kind: (r.x.kind ?? 'other') as ServiceKind, nameAr: r.title, descriptionAr: r.body ?? '' };
    for (const f of X_TEXT_FIELDS) out[f] = s(r.x[f]);
    return out;
  }

  present(r: Rec) {
    const v = this.view(r);
    const out: Record<string, unknown> = { formFileUrl: this.storage.url(r.x.formFile ?? null), id: v.id, kind: v.kind, nameAr: v.nameAr, sortOrder: sortOf(r), isActive: isActive(r), imageUrl: this.storage.url(r.images[0] ?? null), createdAt: r.createdAt, updatedAt: r.updatedAt };
    for (const f of ['nameEn', 'descriptionAr', 'descriptionEn', ...X_TEXT_FIELDS.slice(2)]) out[f] = v[f];
    return out;
  }

  async list(q: ServicesAdminQueryDto) {
    let rows = (await this.store.list(CC.SERVICE)).map((r) => ({ r, v: this.view(r) }));
    if (q.kind) rows = rows.filter(({ v }) => v.kind === q.kind);
    if (q.status) rows = rows.filter(({ r }) => isActive(r) === (q.status === 'active'));
    if (q.q) rows = rows.filter(({ v }) => matches([v.nameAr, v.nameEn, v.departmentAr], q.q!));
    rows = filterByCf(rows, q.cf, { nameAr: (x) => [x.v.nameAr], nameEn: (x) => [x.v.nameEn], departmentAr: (x) => [x.v.departmentAr], feeAr: (x) => [x.v.feeAr] });
    rows.sort(by((x) => sortOf(x.r), (x) => x.r.id));
    return pageRows(rows, q, (x) => this.present(x.r));
  }

  /** one service for the edit window (the public page opens it without going through the Settings table) */
  async adminOne(id: number) {
    const r = await this.store.get(id, CC.SERVICE);
    if (!r) throw new NotFoundException('الخدمة غير موجودة');
    return this.present(r);
  }

  private xOf(dto: CreateServiceDto | UpdateServiceDto) {
    const x: Record<string, any> = { kind: dto.kind, sortOrder: dto.sortOrder === undefined ? undefined : dto.sortOrder ?? 0, isActive: dto.isActive };
    for (const f of X_TEXT_FIELDS) {
      const v = (dto as Record<string, any>)[f];
      if (v !== undefined) x[f] = typeof v === 'string' ? v.trim() || null : null;
    }
    return x;
  }
  private descriptionOf(dto: CreateServiceDto | UpdateServiceDto) {
    const v = (dto as Record<string, any>).descriptionAr;
    return v === undefined ? undefined : typeof v === 'string' ? v.trim() || null : null;
  }

  async create(dto: CreateServiceDto, files: ServiceFiles | undefined, actor: AuthUser) {
    const image = files?.image?.[0];
    const form = files?.form?.[0];
    const path = image ? await this.storage.saveImage(image, 'services', 1200) : null;
    let formPath: string | null = null;
    try {
      formPath = form ? await this.storage.saveDocument(form, 'services') : null;
      const x = this.xOf(dto);
      const r = await this.store.create(CC.SERVICE, { title: dto.nameAr.trim(), body: this.descriptionOf(dto) ?? null, images: path ? [path] : [], x: { ...x, formFile: formPath, sortOrder: x.sortOrder ?? 0, isActive: x.isActive ?? true } });
      await this.audit.log({ category: 'services', action: 'create', description: `إضافة خدمة: ${r.title}`, actorId: actor.id, entityType: 'services', entityId: r.id });
      return this.present(r);
    } catch (e) {
      await this.storage.remove(path); // nothing saved: do not leave an orphan file
      await this.storage.remove(formPath);
      throw e;
    }
  }

  async update(id: number, dto: UpdateServiceDto, files: ServiceFiles | undefined, actor: AuthUser) {
    const cur = await this.store.get(id, CC.SERVICE);
    if (!cur) throw new NotFoundException('الخدمة غير موجودة');
    const image = files?.image?.[0];
    const form = files?.form?.[0];
    const newPath = image ? await this.storage.saveImage(image, 'services', 1200) : null;
    const oldPath = cur.images[0] ?? null;
    const oldForm: string | null = cur.x.formFile ?? null;
    let newForm: string | null = null;
    try {
      newForm = form ? await this.storage.saveDocument(form, 'services') : null;
      const x = this.xOf(dto);
      if (newForm) x.formFile = newForm;
      else if (dto.removeForm) x.formFile = null;
      const r = await this.store.update(id, { title: dto.nameAr?.trim(), body: this.descriptionOf(dto), images: newPath ? [newPath] : dto.removeImage ? [] : undefined, x });
      await this.audit.log({ category: 'services', action: 'update', description: `تعديل خدمة: ${r!.title}`, actorId: actor.id, entityType: 'services', entityId: id });
      if (oldPath && oldPath !== (r!.images[0] ?? null)) await this.storage.remove(oldPath);
      if (oldForm && oldForm !== (r!.x.formFile ?? null)) await this.storage.remove(oldForm);
      return this.present(r!);
    } catch (e) {
      await this.storage.remove(newPath);
      await this.storage.remove(newForm);
      throw e;
    }
  }

  remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(CC.SERVICE);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض الخدمات غير موجودة'); // nothing is deleted
    await this.store.remove(unique);
    await this.storage.removeMany(rows.flatMap((r) => [r.images[0] ?? null, r.x.formFile ?? null]));
    await this.audit.log({ category: 'services', action: 'delete', description: `حذف ${rows.length} خدمة`, actorId: actor.id, entityType: 'services', details: { ids: unique }, changes: removedChanges('services', rows.map((r) => this.view(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public (active only)
  private card(r: Rec, en: boolean) {
    const x = r.x;
    return {
      id: r.id, kind: x.kind ?? 'other', name: pick(r.title, x.nameEn, en), description: pick(r.body, x.descriptionEn, en),
      audience: pick(x.audienceAr, x.audienceEn, en), department: pick(x.departmentAr, x.departmentEn, en), departmentUrl: s(x.departmentUrl), duration: pick(x.durationAr, x.durationEn, en),
      fee: pick(x.feeAr, x.feeEn, en), location: pick(x.locationAr, x.locationEn, en), formUrl: this.storage.url(x.formFile ?? null) ?? s(x.formUrl), formIsFile: !!x.formFile,
      imageUrl: this.storage.url(r.images[0] ?? null),
      documents: lines(en && x.documentsEn ? x.documentsEn : x.documentsAr), steps: lines(en && x.stepsEn ? x.stepsEn : x.stepsAr),
    };
  }

  /** The whole active catalogue (a few dozen rows): the One-Stop page filters, searches and builds its fees table from it. */
  async publicList(q: PublicServicesQueryDto) {
    let rows = (await this.store.list(CC.SERVICE)).filter(isActive);
    if (q.kind) rows = rows.filter((r) => (r.x.kind ?? 'other') === q.kind);
    if (q.q?.trim()) rows = rows.filter((r) => matches([r.title, r.x.nameEn, r.body], q.q!));
    const en = q.lang === 'en';
    return [...rows].sort(by((r) => sortOf(r), (r) => r.id)).slice(0, 200).map((r) => this.card(r, en));
  }

  async publicOne(id: number, lang: string) {
    const r = await this.store.get(id, CC.SERVICE);
    if (!r || !isActive(r)) throw new NotFoundException('الخدمة غير موجودة');
    return this.card(r, lang === 'en');
  }
}
