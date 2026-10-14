import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from '../../entities';
import { NewsAdminController, NewsPublicController } from './news.controller';
import { NewsPublicService } from './news-public.service';
import { NewsService } from './news.service';
import { ViewCounterService } from './view-counter.service';

@Module({
  imports: [TypeOrmModule.forFeature([News])],
  controllers: [NewsAdminController, NewsPublicController],
  providers: [NewsService, NewsPublicService, ViewCounterService],
})
export class NewsModule {}
