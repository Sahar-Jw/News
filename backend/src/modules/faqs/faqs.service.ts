import { Injectable, NotFoundException } from '@nestjs/common';
import { CC } from '../../common/content-categories';
import { AuthUser } from '../../common/types';
import { removedChanges } from '../audit/audit-snapshot';
import { AuditService } from '../audit/audit.service';
import { ContentStore, Rec, isActive, pick, s, sortOf } from '../content/content.store';
import { by, filterByCf, matches, pageRows } from '../content/mem';
import { FaqScope } from './faq.entity';
import { CreateFaqDto, FaqsAdminQueryDto, PublicFaqsQueryDto, UpdateFaqDto } from './faqs.dto';

/**
 * Frequently asked questions: news rows of the main category FAQ. The question is the news title, the answer its body;
 * scope, order, visibility and the English texts live in `extra`.
 */
@Injectable()
export class FaqsService {
  constructor(
    private readonly store: ContentStore,
    private readonly audit: AuditService,
  ) {}

  private view(r: Rec) {
    return {
      id: r.id, scope: (r.x.scope ?? 'general') as FaqScope, questionAr: r.title, questionEn: s(r.x.questionEn), answerAr: r.body ?? '', answerEn: s(r.x.answerEn),
      sortOrder: sortOf(r), isActive: isActive(r), createdAt: r.createdAt, updatedAt: r.updatedAt,
    };
  }

  async list(q: FaqsAdminQueryDto) {
    let rows = (await this.store.list(CC.FAQ)).map((r) => this.view(r));
    if (q.q) rows = rows.filter((f) => matches([f.questionAr, f.questionEn, f.answerAr], q.q!));
    rows = filterByCf(rows, q.cf, { questionAr: (f) => [f.questionAr], questionEn: (f) => [f.questionEn], scope: (f) => [f.scope] });
    if (q.scope) rows = rows.filter((f) => f.scope === q.scope);
    rows.sort(by((f) => f.scope, (f) => f.sortOrder, (f) => f.id));
    return pageRows(rows, q, (f) => f);
  }

  async create(dto: CreateFaqDto, actor: AuthUser) {
    const r = await this.store.create(CC.FAQ, {
      title: dto.questionAr.trim(), body: dto.answerAr.trim(),
      x: { scope: dto.scope ?? 'general', questionEn: dto.questionEn?.trim() || null, answerEn: dto.answerEn?.trim() || null, sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true },
    });
    await this.audit.log({ category: 'faqs', action: 'create', description: `إضافة سؤال شائع: ${r.title}`, actorId: actor.id, entityType: 'faqs', entityId: r.id });
    return this.view(r);
  }

  async update(id: number, dto: UpdateFaqDto, actor: AuthUser) {
    const cur = await this.store.get(id, CC.FAQ);
    if (!cur) throw new NotFoundException('السؤال غير موجود');
    const r = await this.store.update(id, {
      title: dto.questionAr?.trim(), body: dto.answerAr?.trim(),
      x: {
        scope: dto.scope, questionEn: dto.questionEn === undefined ? undefined : dto.questionEn?.trim() || null,
        answerEn: dto.answerEn === undefined ? undefined : dto.answerEn?.trim() || null, sortOrder: dto.sortOrder, isActive: dto.isActive,
      },
    });
    await this.audit.log({ category: 'faqs', action: 'update', description: `تعديل سؤال شائع: ${r!.title}`, actorId: actor.id, entityType: 'faqs', entityId: id });
    return this.view(r!);
  }

  remove(id: number, actor: AuthUser) {
    return this.bulkRemove([id], actor);
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const all = await this.store.list(CC.FAQ);
    const rows = unique.map((id) => all.find((r) => r.id === id)).filter((r): r is Rec => !!r);
    if (rows.length !== unique.length) throw new NotFoundException('بعض الأسئلة غير موجودة'); // nothing is deleted
    await this.store.remove(unique);
    await this.audit.log({ category: 'faqs', action: 'delete', description: `حذف ${rows.length} سؤال شائع`, actorId: actor.id, entityType: 'faqs', details: { ids: unique }, changes: removedChanges('faqs', rows.map((r) => this.view(r))) });
    return { deleted: rows.length };
  }

  /** Public: only active questions; the Arabic text stands in for a missing English one. */
  async publicList(q: PublicFaqsQueryDto) {
    const en = q.lang === 'en';
    return (await this.store.list(CC.FAQ))
      .filter((r) => isActive(r) && (!q.scope || (r.x.scope ?? 'general') === q.scope))
      .sort(by((r) => sortOf(r), (r) => r.id))
      .map((r) => ({ id: r.id, scope: (r.x.scope ?? 'general') as FaqScope, question: pick(r.title, r.x.questionEn, en), answer: pick(r.body, r.x.answerEn, en) }));
  }
}
