import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentLinksModule } from '../content-links/content-links.module';
import { News } from '../news/news.entity';
import { OccasionsAdminController, OccasionsPublicController } from './occasions.controller';
import { OccasionsService } from './occasions.service';

@Module({ imports: [TypeOrmModule.forFeature([News]), ContentLinksModule], controllers: [OccasionsAdminController, OccasionsPublicController], providers: [OccasionsService] })
export class OccasionsModule {}
