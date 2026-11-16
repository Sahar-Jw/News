import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from '../news/news.entity';
import { StatisticsAdminController, StatisticsPublicController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

@Module({
  imports: [TypeOrmModule.forFeature([News])],
  controllers: [StatisticsAdminController, StatisticsPublicController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}
