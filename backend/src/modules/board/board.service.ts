import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike, sanitizeRichText } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { BOARD_POSITIONS, BoardMember, BoardPosition } from './board-member.entity';
import { BoardAdminQueryDto, CreateBoardMemberDto, UpdateBoardMemberDto } from './board.dto';

@Injectable()
export class BoardService {
  constructor(
    @InjectRepository(BoardMember) private readonly repo: Repository<BoardMember>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
  ) {}

  present(m: BoardMember) {
    return {
      id: m.id, position: m.position, nameAr: m.nameAr, nameEn: m.nameEn ?? '', jobTitleAr: m.jobTitleAr ?? '', jobTitleEn: m.jobTitleEn ?? '',
      bioAr: m.bioAr ?? '', bioEn: m.bioEn ?? '', dutiesAr: m.dutiesAr ?? '', dutiesEn: m.dutiesEn ?? '', termLabel: m.termLabel ?? '',
      photoUrl: this.storage.url(m.photo), sortOrder: m.sortOrder, isActive: m.isActive, createdAt: m.createdAt, updatedAt: m.updatedAt,
    };
  }

  async list(q: BoardAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('m');
    if (q.position) qb.andWhere('m.position = :pos', { pos: q.position });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('m.nameAr ILIKE :like', { like }).orWhere('m.nameEn ILIKE :like', { like }).orWhere('m.jobTitleAr ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { nameAr: 'm.nameAr', nameEn: 'm.nameEn', jobTitleAr: 'm.jobTitleAr', termLabel: 'm.termLabel' });
    qb.orderBy('m.sortOrder', 'ASC').addOrderBy('m.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  async create(dto: CreateBoardMemberDto, photo: Express.Multer.File | undefined, actor: AuthUser) {
    const path = photo ? await this.storage.saveImage(photo, 'board', 1200) : null;
    try {
      const saved = await this.repo.save(
        this.repo.create({
          position: dto.position as BoardPosition, nameAr: dto.nameAr.trim(), nameEn: dto.nameEn?.trim() || null,
          jobTitleAr: dto.jobTitleAr?.trim() || null, jobTitleEn: dto.jobTitleEn?.trim() || null,
          bioAr: sanitizeRichText(dto.bioAr), bioEn: sanitizeRichText(dto.bioEn), dutiesAr: sanitizeRichText(dto.dutiesAr), dutiesEn: sanitizeRichText(dto.dutiesEn),
          termLabel: dto.termLabel?.trim() || null, photo: path, sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true,
        }),
      );
      await this.audit.log({ category: 'board', action: 'create', description: `إضافة عضو مجلس: ${saved.nameAr}`, actorId: actor.id, entityType: 'board_members', entityId: saved.id });
      return this.present(saved);
    } catch (e) {
      await this.storage.remove(path);
      throw e;
    }
  }

  async update(id: number, dto: UpdateBoardMemberDto, photo: Express.Multer.File | undefined, actor: AuthUser) {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('العضو غير موجود');
    const newPath = photo ? await this.storage.saveImage(photo, 'board', 1200) : null;
    const oldPath = m.photo;
    try {
      if (dto.position !== undefined) m.position = dto.position as BoardPosition;
      if (dto.nameAr !== undefined) m.nameAr = dto.nameAr.trim();
      if (dto.nameEn !== undefined) m.nameEn = dto.nameEn?.trim() || null;
      if (dto.jobTitleAr !== undefined) m.jobTitleAr = dto.jobTitleAr?.trim() || null;
      if (dto.jobTitleEn !== undefined) m.jobTitleEn = dto.jobTitleEn?.trim() || null;
      if (dto.bioAr !== undefined) m.bioAr = sanitizeRichText(dto.bioAr);
      if (dto.bioEn !== undefined) m.bioEn = sanitizeRichText(dto.bioEn);
      if (dto.dutiesAr !== undefined) m.dutiesAr = sanitizeRichText(dto.dutiesAr);
      if (dto.dutiesEn !== undefined) m.dutiesEn = sanitizeRichText(dto.dutiesEn);
      if (dto.termLabel !== undefined) m.termLabel = dto.termLabel?.trim() || null;
      if (dto.sortOrder !== undefined) m.sortOrder = dto.sortOrder;
      if (dto.isActive !== undefined) m.isActive = dto.isActive;
      if (newPath) m.photo = newPath;
      else if (dto.removePhoto) m.photo = null;
      const saved = await this.repo.save(m);
      await this.audit.log({ category: 'board', action: 'update', description: `تعديل عضو مجلس: ${saved.nameAr}`, actorId: actor.id, entityType: 'board_members', entityId: id });
      if (oldPath && oldPath !== saved.photo) await this.storage.remove(oldPath);
      return this.present(saved);
    } catch (e) {
      await this.storage.remove(newPath);
      throw e;
    }
  }

  async remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الأعضاء غير موجودين'); // nothing is deleted
    await this.repo.delete({ id: In(unique) });
    await this.storage.removeMany(rows.map((r) => r.photo));
    await this.audit.log({ category: 'board', action: 'delete', description: `حذف ${rows.length} من أعضاء المجلس`, actorId: actor.id, entityType: 'board_members', details: { ids: unique }, changes: removedChanges('board_members', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public (active only)
  private card(m: BoardMember, en: boolean) {
    return {
      id: m.id, position: m.position, name: (en && m.nameEn) || m.nameAr, jobTitle: (en && m.jobTitleEn) || m.jobTitleAr || '',
      termLabel: m.termLabel ?? '', photoUrl: this.storage.url(m.photo),
    };
  }

  /** All active members, already in hierarchy order: position rank first, then the manual order. */
  async publicList(lang: string) {
    const rows = await this.repo.find({ where: { isActive: true }, order: { sortOrder: 'ASC', id: 'ASC' } });
    const rank = (p: string) => BOARD_POSITIONS.indexOf(p as BoardPosition);
    return rows.sort((a, b) => rank(a.position) - rank(b.position)).map((m) => this.card(m, lang === 'en'));
  }

  async publicOne(id: number, lang: string) {
    const m = await this.repo.findOne({ where: { id, isActive: true } });
    if (!m) throw new NotFoundException('العضو غير موجود');
    const en = lang === 'en';
    return { ...this.card(m, en), bio: (en && m.bioEn) || m.bioAr || '', duties: (en && m.dutiesEn) || m.dutiesAr || '' };
  }
}
