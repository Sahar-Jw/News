import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Brackets, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { adminPage, paged } from '../../common/utils/pagination';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { escapeLike } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { Subscriber } from './subscriber.entity';
import { SubscribersQueryDto } from './subscribers.dto';
import { removedChanges } from '../audit/audit-snapshot';

const OK_MESSAGE = { ar: 'شكراً لك! أرسلنا إليك رسالة لتأكيد بريدك الإلكتروني.', en: 'Thank you! We sent you an e-mail to confirm your address.' };

@Injectable()
export class SubscribersService {
  constructor(
    @InjectRepository(Subscriber) private readonly repo: Repository<Subscriber>,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  private front() {
    return (process.env.FRONTEND_URL || (process.env.CORS_ORIGINS ?? '').split(',')[0] || '').trim().replace(/\/+$/, '');
  }

  private async sendConfirmation(s: Subscriber, lang: 'ar' | 'en') {
    const link = `${this.front()}/${lang}/subscribe/verify/?token=${s.rememberToken}`;
    const unsub = `${this.front()}/${lang}/subscribe/unsubscribe/?token=${s.rememberToken}`;
    const ar = lang === 'ar';
    const html = `<div dir="${ar ? 'rtl' : 'ltr'}" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#1f2937;max-width:520px;margin:auto">
      <p>${ar ? 'مرحباً،' : 'Hello,'}</p>
      <p>${ar ? 'شكراً لاشتراكك في نشرتنا. اضغط الزر أدناه لتأكيد بريدك الإلكتروني وتفعيل الاشتراك:' : 'Thank you for subscribing to our newsletter. Press the button below to confirm your e-mail and activate the subscription:'}</p>
      <p style="text-align:center;margin:28px 0"><a href="${link}" style="background:#2748e8;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">${ar ? 'تأكيد الاشتراك' : 'Confirm subscription'}</a></p>
      <p style="color:#6b7280;font-size:13px">${ar ? 'إذا لم يعمل الزر، انسخ هذا الرابط إلى المتصفح:' : 'If the button does not work, copy this link into your browser:'}<br><a href="${link}">${link}</a></p>
      <p style="color:#9ca3af;font-size:12px">${ar ? 'إذا لم تطلب هذا الاشتراك فتجاهل الرسالة، أو' : 'If you did not ask for this, ignore this message, or'} <a href="${unsub}">${ar ? 'ألغِ الاشتراك' : 'unsubscribe'}</a>.</p></div>`;
    await this.mail.send(s.email, ar ? 'تأكيد الاشتراك في النشرة' : 'Confirm your newsletter subscription', html);
  }

  // ---------------------------------------------------------------- public
  /** Always answers the same way, so nobody can use the form to find out who is subscribed. */
  async subscribe(email: string, lang: 'ar' | 'en' = 'ar') {
    let s = await this.repo.findOne({ where: { email } });
    let action: string;
    if (!s) {
      s = await this.repo.save(this.repo.create({ email, isVerified: false, isActive: false, verifiedAt: null, rememberToken: randomBytes(24).toString('hex') }));
      await this.sendConfirmation(s, lang);
      action = 'subscribe';
    } else if (!s.isVerified) {
      await this.sendConfirmation(s, lang); // not confirmed yet: send the link again
      action = 'subscribe.resend';
    } else if (!s.isActive) {
      s.isActive = true; // a confirmed subscriber who unsubscribed and comes back
      await this.repo.save(s);
      action = 'resubscribe';
    } else {
      action = 'subscribe.existing'; // already subscribed: nothing changes, the visitor gets the same answer
    }
    // public form: no actor, and no e-mail address in the log (the subscriber row has it)
    await this.audit.log({ category: 'subscribers', action, description: 'طلب اشتراك في النشرة من الموقع', entityType: 'subscribers', entityId: s.id });
    return { message: OK_MESSAGE[lang] };
  }

  private async byToken(token: string) {
    const s = await this.repo.findOne({ where: { rememberToken: token } });
    if (!s) throw new NotFoundException('الرابط غير صالح أو منتهي');
    return s;
  }

  async verify(token: string) {
    const s = await this.byToken(token);
    if (!s.isVerified) {
      s.isVerified = true;
      s.verifiedAt = new Date();
    }
    s.isActive = true;
    await this.repo.save(s);
    await this.audit.log({ category: 'subscribers', action: 'verify', description: 'تأكيد اشتراك في النشرة عبر الرابط', entityType: 'subscribers', entityId: s.id });
    return { verified: true };
  }

  async unsubscribe(token: string) {
    const s = await this.byToken(token);
    s.isActive = false;
    await this.repo.save(s);
    await this.audit.log({ category: 'subscribers', action: 'unsubscribe', description: 'إلغاء اشتراك في النشرة عبر الرابط', entityType: 'subscribers', entityId: s.id });
    return { unsubscribed: true };
  }

  // ---------------------------------------------------------------- admin
  private build(q: SubscribersQueryDto) {
    const qb = this.repo.createQueryBuilder('s');
    if (q.isVerified !== undefined) qb.andWhere('s.isVerified = :v', { v: q.isVerified });
    if (q.isActive !== undefined) qb.andWhere('s.isActive = :a', { a: q.isActive });
    if (q.from) qb.andWhere('s.createdAt >= :from', { from: new Date(q.from) });
    if (q.to) qb.andWhere('s.createdAt <= :to', { to: new Date(q.to.length === 10 ? `${q.to}T23:59:59.999Z` : q.to) });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('s.email ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { email: 's.email', rememberToken: 's.rememberToken', verifiedAt: 'CAST(s.verifiedAt AS TEXT)', createdAt: 'CAST(s.createdAt AS TEXT)' });
    qb.orderBy('s.createdAt', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC').addOrderBy('s.id', 'DESC');
    return qb;
  }

  async list(q: SubscribersQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.build(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows, total, p);
  }

  listAll(q: SubscribersQueryDto) {
    return this.build(q).take(10000).getMany();
  }

  async setActive(id: number, isActive: boolean, actor: AuthUser) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('المشترك غير موجود');
    s.isActive = isActive;
    await this.repo.save(s);
    await this.audit.log({ category: 'subscribers', action: isActive ? 'activate' : 'deactivate', description: `${isActive ? 'تفعيل' : 'تعطيل'} مشترك`, actorId: actor.id, entityType: 'subscribers', entityId: id });
    return s;
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض المشتركين غير موجودين');
    await this.repo.delete({ id: In(unique) });
    await this.audit.log({ category: 'subscribers', action: 'delete', description: `حذف ${rows.length} مشترك`, actorId: actor.id, entityType: 'subscribers', details: { ids: unique }, changes: removedChanges('subscribers', rows) });
    return { deleted: rows.length };
  }
}
