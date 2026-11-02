import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { Faq, FaqScope } from './faq.entity';
import { CreateFaqDto, FaqsAdminQueryDto, PublicFaqsQueryDto, UpdateFaqDto } from './faqs.dto';

@Injectable()
export class FaqsService {
  constructor(
    @InjectRepository(Faq) private readonly repo: Repository<Faq>,
    private readonly audit: AuditService,
  ) {}

  present(f: Faq) {
    return {
      id: f.id, scope: f.scope,
      questionAr: f.questionAr, questionEn: f.questionEn ?? '',
      answerAr: f.answerAr, answerEn: f.answerEn ?? '',
      sortOrder: f.sortOrder, isActive: f.isActive,
      createdAt: f.createdAt, updatedAt: f.updatedAt,
    };
  }

  async list(q: FaqsAdminQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('f');
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('f.questionAr ILIKE :like', { like }).orWhere('f.questionEn ILIKE :like', { like }).orWhere('f.answerAr ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { questionAr: 'f.questionAr', questionEn: 'f.questionEn', scope: 'f.scope' });
    if (q.scope) qb.andWhere('f.scope = :scope', { scope: q.scope });
    qb.orderBy('f.scope', 'ASC').addOrderBy('f.sortOrder', 'ASC').addOrderBy('f.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  async create(dto: CreateFaqDto, actor: AuthUser) {
    const saved = await this.repo.save(
      this.repo.create({
        scope: (dto.scope as FaqScope) ?? 'general',
        questionAr: dto.questionAr.trim(), questionEn: dto.questionEn?.trim() || null,
        answerAr: dto.answerAr.trim(), answerEn: dto.answerEn?.trim() || null,
        sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true,
      }),
    );
    await this.audit.log({ category: 'faqs', action: 'create', description: `إضافة سؤال شائع: ${saved.questionAr}`, actorId: actor.id, entityType: 'faqs', entityId: saved.id });
    return this.present(saved);
  }

  async update(id: number, dto: UpdateFaqDto, actor: AuthUser) {
    const f = await this.repo.findOne({ where: { id } });
    if (!f) throw new NotFoundException('السؤال غير موجود');
    if (dto.scope !== undefined) f.scope = dto.scope as FaqScope;
    if (dto.questionAr !== undefined) f.questionAr = dto.questionAr.trim();
    if (dto.questionEn !== undefined) f.questionEn = dto.questionEn?.trim() || null;
    if (dto.answerAr !== undefined) f.answerAr = dto.answerAr.trim();
    if (dto.answerEn !== undefined) f.answerEn = dto.answerEn?.trim() || null;
    if (dto.sortOrder !== undefined) f.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) f.isActive = dto.isActive;
    const saved = await this.repo.save(f);
    await this.audit.log({ category: 'faqs', action: 'update', description: `تعديل سؤال شائع: ${saved.questionAr}`, actorId: actor.id, entityType: 'faqs', entityId: id });
    return this.present(saved);
  }

  async remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض الأسئلة غير موجودة'); // nothing is deleted
    await this.repo.delete({ id: In(unique) });
    await this.audit.log({ category: 'faqs', action: 'delete', description: `حذف ${rows.length} سؤال شائع`, actorId: actor.id, entityType: 'faqs', details: { ids: unique }, changes: removedChanges('faqs', rows) });
    return { deleted: rows.length };
  }

  /** Public: only active questions; the Arabic text stands in for a missing English one. */
  async publicList(q: PublicFaqsQueryDto) {
    const en = q.lang === 'en';
    const rows = await this.repo.find({
      where: { isActive: true, ...(q.scope ? { scope: q.scope as FaqScope } : {}) },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return rows.map((f) => ({
      id: f.id, scope: f.scope,
      question: (en && f.questionEn) || f.questionAr,
      answer: (en && f.answerEn) || f.answerAr,
    }));
  }
}
