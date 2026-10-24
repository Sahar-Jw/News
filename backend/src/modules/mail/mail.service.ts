import { Injectable, Logger } from '@nestjs/common';

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
  return v ? v.trim() : undefined;
};

/** Sends e-mail through SMTP when SMTP_HOST (or MAIL_HOST) is configured; otherwise it only logs (nothing is sent, nothing fails). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transport: any = null;

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

  /** Never throws: a mail problem must not break the subscription itself. */
  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.enabled) {
      this.logger.warn(`SMTP not configured (set SMTP_HOST or MAIL_HOST in .env): e-mail "${subject}" to ${to} was NOT sent.`);
      return false;
    }
    try {
      await this.tx.sendMail({ from: env('FROM') || env('USER'), to, subject, html });
      return true;
    } catch (e) {
      this.logger.error(`Could not send e-mail to ${to}: ${(e as Error).message}`);
      return false;
    }
  }
}
