import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsModule } from '../statistics/statistics.module';
import { News } from './news.entity';
import { NewsAdminController, NewsPublicController } from './news.controller';
import { NewsPublicService } from './news-public.service';
import { NewsService } from './news.service';
import { ViewCounterService } from './view-counter.service';

@Module({
  imports: [TypeOrmModule.forFeature([News]), StatisticsModule],
  controllers: [NewsAdminController, NewsPublicController],
  providers: [NewsService, NewsPublicService, ViewCounterService],
})
export class NewsModule {}
