import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

/** SMTP mail, shared by the newsletter confirmation and the password reset. */
@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
