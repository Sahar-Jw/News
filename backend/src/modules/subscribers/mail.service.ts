import { Injectable, Logger } from '@nestjs/common';

let nodemailer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

/** Sends e-mail through SMTP when SMTP_HOST is configured; otherwise it only logs (nothing is sent, nothing fails). */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transport: any = null;

  get enabled() {
    return !!(nodemailer && process.env.SMTP_HOST);
  }

  private get tx() {
    if (!this.transport) {
      this.transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
    }
    return this.transport;
  }

  /** Never throws: a mail problem must not break the subscription itself. */
  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.enabled) {
      this.logger.warn(`SMTP not configured: e-mail "${subject}" to ${to} was NOT sent.`);
      return false;
    }
    try {
      await this.tx.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html });
      return true;
    } catch (e) {
      this.logger.error(`Could not send e-mail to ${to}: ${(e as Error).message}`);
      return false;
    }
  }
}
