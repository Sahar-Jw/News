import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DOC_CODES, docCode, kindOfDocCode } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { publicPage, paged } from '../../common/utils/pagination';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { ContentStore, Rec, isActive, pick, s } from '../content/content.store';
import { filterByCf, matches, pageRows } from '../content/mem';
import { FileStorageService } from '../files/file-storage.service';
import { DocumentKind, OFFICIAL_DOCUMENT_KINDS } from './document.entity';
import { CreateDocumentDto, DocumentsAdminQueryDto, PublicDocumentsQueryDto, UpdateDocumentDto } from './documents.dto';

/**
 * Official documents and the digital library: news rows whose main category is the kind (DOC_CIRCULAR, DOC_DECISION, DOC_LAW ...).
 * Title = Arabic title, body = Arabic summary, pdf = the file; number, issuer, date and the English texts live in `extra`.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly store: ContentStore,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
  ) {}

  private view(r: Rec) {
    return {
      id: r.id, kind: kindOfDocCode(r.code) as DocumentKind, docNumber: s(r.x.docNumber), titleAr: r.title, titleEn: s(r.x.titleEn), summaryAr: r.body ?? '', summaryEn: s(r.x.summaryEn),
      issuerAr: s(r.x.issuerAr), issuerEn: s(r.x.issuerEn), docDate: (r.x.docDate ?? null) as string | null, file: r.pdf as string, fileUrl: this.storage.url(r.pdf), isActive: isActive(r),
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }

  /** docDate newest first, undated last, then newest id first (what ORDER BY doc_date DESC NULLS LAST, id DESC did) */
  private static newest = (a: { docDate: string | null; id: number }, b: { docDate: string | null; id: number }) => {
    if (a.docDate !== b.docDate) {
      if (!a.docDate) return 1;
      if (!b.docDate) return -1;
      return a.docDate < b.docDate ? 1 : -1;
    }
    return b.id - a.id;
  };

  async list(q: DocumentsAdminQueryDto) {
    let rows = (await this.store.list(q.kind ? docCode(q.kind) : DOC_CODES)).map((r) => this.view(r));
    if (q.q) rows = rows.filter((d) => matches([d.titleAr, d.titleEn, d.docNumber], q.q!));
    rows = filterByCf(rows, q.cf, { titleAr: (d) => [d.titleAr], titleEn: (d) => [d.titleEn], docNumber: (d) => [d.docNumber] });
    rows.sort(DocumentsService.newest);
    return pageRows(rows, q, (d) => d);
  }

  async create(dto: CreateDocumentDto, file: Express.Multer.File | undefined, actor: AuthUser) {
    if (!file) throw new BadRequestException('ملف PDF مطلوب');
    const path = await this.storage.savePdf(file, 'documents');
    try {
      const r = await this.store.create(docCode(dto.kind), {
        title: dto.titleAr.trim(), body: dto.summaryAr?.trim() || null, pdf: path,
        x: {
          docNumber: dto.docNumber?.trim() || null, titleEn: dto.titleEn?.trim() || null, summaryEn: dto.summaryEn?.trim() || null,
          issuerAr: dto.issuerAr?.trim() || null, issuerEn: dto.issuerEn?.trim() || null, docDate: dto.docDate ? dto.docDate.slice(0, 10) : null, isActive: dto.isActive ?? true,
        },
      });
      await this.audit.log({ category: 'documents', action: 'create', description: `إضافة وثيقة: ${r.title}`, actorId: actor.id, entityType: 'documents', entityId: r.id });
      return this.view(r);
    } catch (e) {
      await this.storage.remove(path); // nothing saved: do not leave an orphan file
      throw e;
    }
  }

  async update(id: number, dto: UpdateDocumentDto, file: Express.Multer.File | undefined, actor: AuthUser) {
    const cur = await this.store.get(id, DOC_CODES);
    if (!cur) throw new NotFoundException('الوثيقة غير موجودة');
    const newPath = file ? await this.storage.savePdf(file, 'documents') : null;
    try {
      const r = await this.store.update(id, {
        code: dto.kind !== undefined ? docCode(dto.kind) : undefined, title: dto.titleAr?.trim(), body: dto.summaryAr === undefined ? undefined : dto.summaryAr?.trim() || null,
        pdf: newPath ?? undefined,
        x: {
          docNumber: dto.docNumber === undefined ? undefined : dto.docNumber?.trim() || null, titleEn: dto.titleEn === undefined ? undefined : dto.titleEn?.trim() || null,
          summaryEn: dto.summaryEn === undefined ? undefined : dto.summaryEn?.trim() || null, issuerAr: dto.issuerAr === undefined ? undefined : dto.issuerAr?.trim() || null,
          issuerEn: dto.issuerEn === undefined ? undefined : dto.issuerEn?.trim() || null, docDate: dto.docDate === undefined ? undefined : dto.docDate ? dto.docDate.slice(0, 10) : null, isActive: dto.isActive,
        },
      });
      await this.audit.log({ category: 'documents', action: 'update', description: `تعديل وثيقة: ${r!.title}`, actorId: actor.id, entityType: 'documents', entityId: id });
      if (newPath) await this.storage.remove(cur.pdf);
      return this.view(r!);
    } catch (e) {
      if (newPath) await this.storage.remove(newPath);
      throw e;
    }
  }

  async remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(DOC_CODES);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض الوثائق غير موجودة'); // nothing is deleted
    await this.store.remove(unique);
    await this.storage.removeMany(rows.map((r) => r.pdf));
    await this.audit.log({ category: 'documents', action: 'delete', description: `حذف ${rows.length} وثيقة`, actorId: actor.id, entityType: 'documents', details: { ids: unique }, changes: removedChanges('documents', rows.map((r) => this.view(r))) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public (active only)
  private card(r: Rec, en: boolean) {
    const d = this.view(r);
    return {
      id: d.id, kind: d.kind, docNumber: d.docNumber, docDate: d.docDate, issuer: pick(d.issuerAr, d.issuerEn, en), title: pick(d.titleAr, d.titleEn, en),
      summary: pick(d.summaryAr, d.summaryEn, en), fileUrl: d.fileUrl,
    };
  }

  /** the codes a public request is about: one kind, the official ones, or every kind */
  private codesOf(kind?: string, scope?: string) {
    return kind ? [docCode(kind)] : scope === 'official' ? OFFICIAL_DOCUMENT_KINDS.map(docCode) : DOC_CODES;
  }

  async publicList(q: PublicDocumentsQueryDto) {
    const p = publicPage(q, 12, 50);
    let rows = (await this.store.list(this.codesOf(q.kind, q.scope))).filter(isActive).map((r) => ({ r, d: this.view(r) }));
    if (q.issuer?.trim()) rows = rows.filter(({ d }) => d.issuerAr === q.issuer!.trim() || d.issuerEn === q.issuer!.trim());
    if (q.from) rows = rows.filter(({ d }) => !!d.docDate && d.docDate >= q.from!.slice(0, 10));
    if (q.to) rows = rows.filter(({ d }) => !!d.docDate && d.docDate <= q.to!.slice(0, 10));
    if (q.q?.trim()) rows = rows.filter(({ d }) => matches([d.titleAr, d.titleEn, d.docNumber, d.summaryAr], q.q!));
    rows.sort((a, b) => DocumentsService.newest(a.d, b.d));
    const en = q.lang === 'en';
    return paged(rows.slice(p.skip, p.skip + p.limit).map(({ r }) => this.card(r, en)), rows.length, p);
  }

  /** Issuers of the visible documents (for the filter box of the public page). */
  async publicIssuers(lang: string, kind?: string, scope?: string) {
    const en = lang === 'en';
    const names = (await this.store.list(this.codesOf(kind, scope))).filter(isActive).filter((r) => s(r.x.issuerAr) !== '').map((r) => pick(r.x.issuerAr, r.x.issuerEn, en));
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, en ? 'en' : 'ar'));
  }

  async publicOne(id: number, lang: string) {
    const r = await this.store.get(id, DOC_CODES);
    if (!r || !isActive(r)) throw new NotFoundException('الوثيقة غير موجودة');
    return { ...this.card(r, lang === 'en'), file: r.pdf };
  }
}
