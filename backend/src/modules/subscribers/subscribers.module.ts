import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailService } from './mail.service';
import { Subscriber } from './subscriber.entity';
import { SubscribersController } from './subscribers.controller';
import { SubscribersService } from './subscribers.service';

@Module({ imports: [TypeOrmModule.forFeature([Subscriber])], controllers: [SubscribersController], providers: [SubscribersService, MailService] })
export class SubscribersModule {}
