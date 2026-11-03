import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged, publicPage } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { Document, DocumentKind } from './document.entity';
import { CreateDocumentDto, DocumentsAdminQueryDto, PublicDocumentsQueryDto, UpdateDocumentDto } from './documents.dto';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private readonly repo: Repository<Document>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
  ) {}

  present(d: Document) {
    return {
      id: d.id, kind: d.kind, docNumber: d.docNumber ?? '',
      titleAr: d.titleAr, titleEn: d.titleEn ?? '', summaryAr: d.summaryAr ?? '', summaryEn: d.summaryEn ?? '',
      issuerAr: d.issuerAr ?? '', issuerEn: d.issuerEn ?? '', docDate: d.docDate, file: d.file, fileUrl: this.storage.url(d.file), isActive: d.isActive,
      createdAt: d.createdAt, updatedAt: d.updatedAt,
    };
  }

  async list(q: DocumentsAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('d');
    if (q.kind) qb.andWhere('d.kind = :kind', { kind: q.kind });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('d.titleAr ILIKE :like', { like }).orWhere('d.titleEn ILIKE :like', { like }).orWhere('d.docNumber ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { titleAr: 'd.titleAr', titleEn: 'd.titleEn', docNumber: 'd.docNumber' });
    qb.orderBy('d.docDate', 'DESC', 'NULLS LAST').addOrderBy('d.id', 'DESC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  async create(dto: CreateDocumentDto, file: Express.Multer.File | undefined, actor: AuthUser) {
    if (!file) throw new BadRequestException('ملف PDF مطلوب');
    const path = await this.storage.savePdf(file, 'documents');
    try {
      const saved = await this.repo.save(
        this.repo.create({
          kind: dto.kind as DocumentKind, docNumber: dto.docNumber?.trim() || null,
          titleAr: dto.titleAr.trim(), titleEn: dto.titleEn?.trim() || null,
          summaryAr: dto.summaryAr?.trim() || null, summaryEn: dto.summaryEn?.trim() || null,
          issuerAr: dto.issuerAr?.trim() || null, issuerEn: dto.issuerEn?.trim() || null,
          docDate: dto.docDate ? dto.docDate.slice(0, 10) : null, file: path, isActive: dto.isActive ?? true,
        }),
      );
      await this.audit.log({ category: 'documents', action: 'create', description: `إضافة وثيقة: ${saved.titleAr}`, actorId: actor.id, entityType: 'documents', entityId: saved.id });
      return this.present(saved);
    } catch (e) {
      await this.storage.remove(path); // nothing saved: do not leave an orphan file
      throw e;
    }
  }

  async update(id: number, dto: UpdateDocumentDto, file: Express.Multer.File | undefined, actor: AuthUser) {
    const d = await this.repo.findOne({ where: { id } });
    if (!d) throw new NotFoundException('الوثيقة غير موجودة');
    const newPath = file ? await this.storage.savePdf(file, 'documents') : null;
    const oldPath = d.file;
    try {
      if (dto.kind !== undefined) d.kind = dto.kind as DocumentKind;
      if (dto.docNumber !== undefined) d.docNumber = dto.docNumber?.trim() || null;
      if (dto.titleAr !== undefined) d.titleAr = dto.titleAr.trim();
      if (dto.titleEn !== undefined) d.titleEn = dto.titleEn?.trim() || null;
      if (dto.summaryAr !== undefined) d.summaryAr = dto.summaryAr?.trim() || null;
      if (dto.summaryEn !== undefined) d.summaryEn = dto.summaryEn?.trim() || null;
      if (dto.issuerAr !== undefined) d.issuerAr = dto.issuerAr?.trim() || null;
      if (dto.issuerEn !== undefined) d.issuerEn = dto.issuerEn?.trim() || null;
      if (dto.docDate !== undefined) d.docDate = dto.docDate ? dto.docDate.slice(0, 10) : null;
      if (dto.isActive !== undefined) d.isActive = dto.isActive;
      if (newPath) d.file = newPath;
      const saved = await this.repo.save(d);
      await this.audit.log({ category: 'documents', action: 'update', description: `تعديل وثيقة: ${saved.titleAr}`, actorId: actor.id, entityType: 'documents', entityId: id });
      if (newPath) await this.storage.remove(oldPath);
      return this.present(saved);
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
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الوثائق غير موجودة'); // nothing is deleted
    await this.repo.delete({ id: In(unique) });
    await this.storage.removeMany(rows.map((r) => r.file));
    await this.audit.log({ category: 'documents', action: 'delete', description: `حذف ${rows.length} وثيقة`, actorId: actor.id, entityType: 'documents', details: { ids: unique }, changes: removedChanges('documents', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public (active only)
  private card(d: Document, en: boolean) {
    return {
      id: d.id, kind: d.kind, docNumber: d.docNumber ?? '', docDate: d.docDate, issuer: (en && d.issuerEn) || d.issuerAr || '',
      title: (en && d.titleEn) || d.titleAr, summary: (en && d.summaryEn) || d.summaryAr || '',
      fileUrl: this.storage.url(d.file),
    };
  }

  async publicList(q: PublicDocumentsQueryDto) {
    const p = publicPage(q, 12, 50);
    const qb = this.repo.createQueryBuilder('d').where('d.isActive = true');
    if (q.kind) qb.andWhere('d.kind = :kind', { kind: q.kind });
    if (q.issuer?.trim()) qb.andWhere('(d.issuerAr = :issuer OR d.issuerEn = :issuer)', { issuer: q.issuer.trim() });
    if (q.from) qb.andWhere('d.docDate >= :from', { from: q.from.slice(0, 10) });
    if (q.to) qb.andWhere('d.docDate <= :to', { to: q.to.slice(0, 10) });
    if (q.q?.trim()) {
      const like = `%${escapeLike(q.q.trim())}%`;
      qb.andWhere(new Brackets((b) => b.where('d.titleAr ILIKE :like', { like }).orWhere('d.titleEn ILIKE :like', { like }).orWhere('d.docNumber ILIKE :like', { like }).orWhere('d.summaryAr ILIKE :like', { like })));
    }
    qb.orderBy('d.docDate', 'DESC', 'NULLS LAST').addOrderBy('d.id', 'DESC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    const en = q.lang === 'en';
    return paged(rows.map((r) => this.card(r, en)), total, p);
  }

  /** Issuers of the visible documents (for the filter box of the public page). */
  async publicIssuers(lang: string, kind?: string) {
    const qb = this.repo.createQueryBuilder('d').select('d.issuerAr', 'ar').addSelect('d.issuerEn', 'en').where('d.isActive = true').andWhere("d.issuerAr IS NOT NULL AND d.issuerAr <> ''");
    if (kind) qb.andWhere('d.kind = :kind', { kind });
    const rows = await qb.groupBy('d.issuerAr').addGroupBy('d.issuerEn').getRawMany<{ ar: string; en: string | null }>();
    const en = lang === 'en';
    return [...new Set(rows.map((r) => (en && r.en) || r.ar))].sort((a, b) => a.localeCompare(b, en ? 'en' : 'ar'));
  }

  async publicOne(id: number, lang: string) {
    const d = await this.repo.findOne({ where: { id, isActive: true } });
    if (!d) throw new NotFoundException('الوثيقة غير موجودة');
    return { ...this.card(d, lang === 'en'), file: d.file };
  }
}
