import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSetting } from '../settings/site-setting.entity';

/** The parts of the site that send mail. Each can have its own sender name and reply-to address (Settings -> Identity & contact -> mail). */
export const MAIL_PAGES = ['system', 'newsletter', 'membership', 'get2trade', 'training', 'incubator', 'expo', 'forms'] as const;
export type MailPage = (typeof MAIL_PAGES)[number];

let nodemailer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

/** Reads SMTP_<NAME>, or MAIL_<NAME> when that is the one set in .env (HOST, PORT, SECURE, USER, PASS, FROM). */
const env = (name: string): string | undefined => {
  const v = process.env[`SMTP_${name}`] || process.env[`MAIL_${name}`];
  // hosting panels often keep the quotes that a .env file would drop (MAIL_FROM="NEWS <a@b.com>"): remove one surrounding pair
  return v ? v.trim().replace(/^(["'])([\s\S]*)\1$/, '$2').trim() : undefined;
};

/** Sends e-mail through SMTP when SMTP_HOST (or MAIL_HOST) is configured; otherwise it only logs (nothing is sent, nothing fails). */
@Injectable()
export class MailService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MailService.name);
  private transport: any = null;

  constructor(@InjectRepository(SiteSetting) private readonly settings: Repository<SiteSetting>) {}

  /** Says in the log, once at start-up, whether mail is configured and whether the SMTP server accepts the login (never blocks or stops the start). */
  onApplicationBootstrap() {
    if (!this.enabled) {
      this.logger.warn(nodemailer ? 'Mail is OFF: set MAIL_HOST (or SMTP_HOST) in the environment variables of the BACKEND service; a .env file is not part of the Docker image.' : 'Mail is OFF: the nodemailer package is not installed.');
      return;
    }
    const where = `${env('HOST')}:${env('PORT') || 587}${env('USER') ? ` as ${env('USER')}` : ' (no login)'}`;
    this.tx.verify().then(() => this.logger.log(`Mail is ON: connected to ${where}`)).catch((e: Error) => this.logger.error(`Mail is configured but the SMTP check FAILED for ${where}: ${e.message}. Mail will not be delivered until this is fixed.`));
  }

  get enabled() {
    return !!(nodemailer && env('HOST'));
  }

  private get tx() {
    if (!this.transport) {
      const port = Number(env('PORT') || 587);
      const secure = env('SECURE') === 'true' || port === 465; // 465 = TLS from the start, 587 = STARTTLS
      this.transport = nodemailer.createTransport({
        host: env('HOST'),
        port,
        secure,
        requireTLS: !secure && port === 587,
        auth: env('USER') ? { user: env('USER'), pass: (env('PASS') ?? '').replace(/\s+/g, '') } : undefined, // Gmail shows app passwords in groups of 4
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 20_000,
      });
    }
    return this.transport;
  }

  /** { name, address } of the account mail is sent from, taken from MAIL_FROM ("Name <a@b.com>" or just the address) or MAIL_USER. */
  private base(): { name?: string; address: string } | null {
    const raw = env('FROM') || env('USER');
    if (!raw) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const [one] = require('nodemailer/lib/addressparser')(raw);
      if (one?.address) return { name: one.name || undefined, address: one.address };
    } catch { /* fall through */ }
    return { address: raw };
  }

  /**
   * One sender account serves the whole site (Gmail lets you send only as the logged-in account), but every part of the site can look separate:
   * its own sender NAME and a REPLY-TO address (settings mail.<page>_name / mail.<page>_reply_to). Empty = the account's own name, replies to the account.
   */
  private async identity(page: MailPage) {
    const out: { from?: { name: string; address: string }; replyTo?: string } = {};
    try {
      const rows = await this.settings.find({ where: [{ category: 'mail', key: `${page}_name` }, { category: 'mail', key: `${page}_reply_to` }] });
      const val = (k: string) => (rows.find((r) => r.key === k)?.value ?? '').toString().trim();
      const name = val(`${page}_name`).replace(/[\r\n<>"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      const reply = val(`${page}_reply_to`);
      const base = this.base();
      if (name && base) out.from = { name, address: base.address };
      if (reply && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(reply)) out.replyTo = reply;
    } catch (e) {
      this.logger.warn(`Could not read the mail identity of "${page}": ${(e as Error).message}`);
    }
    return out;
  }

  /** `mail.as('membership').send(...)`: the same as send(), with the sender name / reply-to that Settings gives to that part of the site. */
  as(page: MailPage) {
    return { send: (to: string, subject: string, html: string, headers?: Record<string, string>) => this.send(to, subject, html, headers, page) };
  }

  /** What is configured (never the password): for the admin's mail check. */
  status() {
    const port = Number(env('PORT') || 587);
    const base = this.base();
    return {
      enabled: this.enabled, packageInstalled: !!nodemailer, host: env('HOST') ?? null, port, secure: env('SECURE') === 'true' || port === 465,
      user: env('USER') ?? null, hasPassword: !!env('PASS'), from: base ? (base.name ? `${base.name} <${base.address}>` : base.address) : null,
    };
  }

  /** Real attempt for the admin's "send a test": connects, logs in, sends, and tells the exact reason when something fails. */
  async test(to: string): Promise<{ ok: boolean; code?: string; message?: string; response?: string }> {
    if (!this.enabled) return { ok: false, code: 'NOT_CONFIGURED', message: 'MAIL_HOST (or SMTP_HOST) is not set in the backend environment' };
    try {
      await this.tx.verify();
      await this.tx.sendMail({ from: env('FROM') || env('USER'), to, subject: 'Test e-mail / \u0631\u0633\u0627\u0644\u0629 \u0627\u062e\u062a\u0628\u0627\u0631', html: '<p>The mail settings of the site work. / \u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0628\u0631\u064a\u062f \u0641\u064a \u0627\u0644\u0645\u0648\u0642\u0639 \u062a\u0639\u0645\u0644.</p>' });
      return { ok: true };
    } catch (e) {
      const err = e as Error & { code?: string; response?: string };
      this.transport = null; // next attempt builds a fresh connection
      this.logger.error(`Mail test to ${to} failed: ${err.code ?? ''} ${err.message}`);
      return { ok: false, code: err.code, message: err.message, response: err.response };
    }
  }

  /** Never throws: a mail problem must not break the subscription itself. */
  async send(to: string, subject: string, html: string, headers?: Record<string, string>, page: MailPage = 'system'): Promise<boolean> {
    if (!this.enabled) {
      this.logger.warn(`SMTP not configured (set SMTP_HOST or MAIL_HOST in .env): e-mail "${subject}" to ${to} was NOT sent.`);
      return false;
    }
    try {
      const id = await this.identity(page);
      await this.tx.sendMail({ from: id.from ?? (env('FROM') || env('USER')), replyTo: id.replyTo, to, subject, html, headers });
      return true;
    } catch (e) {
      this.logger.error(`Could not send e-mail to ${to}: ${(e as Error).message}`);
      return false;
    }
  }
}
