import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from '../news/news.entity';
import { Subscriber } from './subscriber.entity';
import { NewsletterService } from './newsletter.service';
import { SubscribersController } from './subscribers.controller';
import { SubscribersService } from './subscribers.service';

@Module({ imports: [TypeOrmModule.forFeature([Subscriber, News])], controllers: [SubscribersController], providers: [SubscribersService, NewsletterService] })
export class SubscribersModule {}
