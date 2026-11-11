import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteSetting } from '../settings/site-setting.entity';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

/** SMTP mail shared by every part of the site (newsletter, membership, Get2Trade, training, incubator, EXPO, password reset). */
@Global()
@Module({ imports: [TypeOrmModule.forFeature([SiteSetting])], controllers: [MailController], providers: [MailService], exports: [MailService] })
export class MailModule {}
