import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Language, NewsStatus, Visibility } from '../../common/constants';
import { NEWSLETTER_TOPIC_LABELS, NewsletterTopic, pathOfCategory, topicOfCategory } from '../../common/newsletter-topics';
import { esc } from '../training/training-mail';
import { MailService } from '../mail/mail.service';
import { News } from '../news/news.entity';
import { Subscriber } from './subscriber.entity';

/** Only rows published in the last 2 days are mailed: an old row that gets (re)published by an import or a restore never floods the list. */
const FRESH_MS = 2 * 24 * 3600 * 1000;
const TICK_MS = 60_000;
const GAP_MS = 250; // between two e-mails (Gmail SMTP allows about 500 a day, and a burst gets the account blocked)

/**
 * Newsletter: a minute after a row of a mailed kind goes live (any way: admin form, scheduled publishing, other modules, SQL), every confirmed and
 * active subscriber who chose that topic (or chose nothing = everything) and whose language is the row's language gets one e-mail with a link
 * to it and their own unsubscribe link. `newsletter_dispatches` guarantees a row is mailed once. Switch off with NEWSLETTER_AUTO_SEND=false.
 */
@Injectable()
export class NewsletterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsletterService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;

  constructor(
    @InjectRepository(News) private readonly news: Repository<News>,
    @InjectRepository(Subscriber) private readonly subs: Repository<Subscriber>,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    if (process.env.NEWSLETTER_AUTO_SEND === 'false') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private front() {
    return (process.env.FRONTEND_URL || (process.env.CORS_ORIGINS ?? '').split(',')[0] || '').trim().replace(/\/+$/, '');
  }

  private async tick() {
    if (this.busy || !this.mail.enabled) return; // without SMTP nothing is claimed, so the rows are mailed once SMTP is set
    this.busy = true;
    try {
      const rows: { id: string }[] = await this.news.query(
        `SELECT n.id FROM news n
         WHERE n.status = $1 AND n.visibility = $2 AND n.publish_at <= now() AND n.publish_at > $3
           AND COALESCE(n.extra->>'isActive', 'true') <> 'false'
           AND NOT EXISTS (SELECT 1 FROM newsletter_dispatches d WHERE d.news_id = n.id)
         ORDER BY n.publish_at LIMIT 20`,
        [NewsStatus.PUBLISHED, Visibility.PUBLIC, new Date(Date.now() - FRESH_MS)],
      );
      for (const r of rows) await this.dispatch(Number(r.id));
    } catch (e) {
      this.logger.error(`Newsletter run failed: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  private async dispatch(id: number) {
    // claim first: whoever inserts the row sends, so two instances (or a restart in the middle) never mail it twice
    const claimed = await this.news.query(`INSERT INTO newsletter_dispatches (news_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING news_id`, [id]);
    if (!claimed.length) return;
    const n = await this.news.findOne({ where: { id }, select: { id: true, title: true, subject: true, excerpt: true, mainCategory: true, language: true } });
    const topic = n ? topicOfCategory(n.mainCategory) : null;
    if (!n || !topic) return;
    const lang: 'ar' | 'en' = n.language === Language.EN ? 'en' : 'ar';
    const people = await this.subs
      .createQueryBuilder('s')
      .where('s.isVerified = true AND s.isActive = true AND s.language = :lang', { lang })
      .andWhere(`(s.topics IS NULL OR jsonb_array_length(s.topics) = 0 OR s.topics @> CAST(:topic AS jsonb))`, { topic: JSON.stringify([topic]) })
      .getMany();
    let sent = 0;
    for (const s of people) {
      const m = this.compose(n, topic, lang, s);
      if (await this.mail.as('newsletter').send(s.email, m.subject, m.html, m.headers)) sent++;
      await new Promise((r) => setTimeout(r, GAP_MS));
    }
    await this.news.query(`UPDATE newsletter_dispatches SET recipients = $2, sent_at = now() WHERE news_id = $1`, [id, sent]);
    this.logger.log(`Newsletter for news #${id} (${topic}, ${lang}): ${sent}/${people.length} sent`);
  }

  private compose(n: News, topic: NewsletterTopic, lang: 'ar' | 'en', s: Subscriber) {
    const ar = lang === 'ar';
    const base = `${this.front()}/${lang}`;
    const link = `${base}${pathOfCategory(n.mainCategory, n.id)}`;
    const unsub = `${base}/subscribe/unsubscribe/?token=${s.rememberToken}`;
    const manage = `${base}/subscribe/preferences/?token=${s.rememberToken}`;
    const label = NEWSLETTER_TOPIC_LABELS[topic][lang];
    const text = n.subject || n.excerpt || '';
    const html = `<div dir="${ar ? 'rtl' : 'ltr'}" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#1f2937;max-width:560px;margin:auto">
      <p style="color:#6b7280;font-size:13px;margin:0">${esc(label)}</p>
      <h2 style="margin:4px 0 12px">${esc(n.title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}
      <p style="text-align:center;margin:28px 0"><a href="${link}" style="background:#2748e8;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;display:inline-block">${ar ? 'عرض التفاصيل' : 'View details'}</a></p>
      <hr style="border:none;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px">${ar ? 'وصلتك هذه الرسالة لأنك مشترك في نشرتنا البريدية.' : 'You receive this because you subscribed to our newsletter.'} <a href="${manage}">${ar ? 'اختيار المواضيع' : 'Choose topics'}</a> · <a href="${unsub}">${ar ? 'إلغاء الاشتراك' : 'Unsubscribe'}</a></p></div>`;
    return { subject: n.title, html, headers: { 'List-Unsubscribe': `<${unsub}>` } as Record<string, string> };
  }
}
