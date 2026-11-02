import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentLinksModule } from '../content-links/content-links.module';
import { FilesModule } from '../files/files.module';
import { News } from '../news/news.entity';
import { Committee, CommitteeActivity, CommitteeMember } from './committee.entity';
import { CommitteesAdminController, CommitteesPublicController } from './committees.controller';
import { CommitteesService } from './committees.service';

@Module({
  imports: [TypeOrmModule.forFeature([Committee, CommitteeMember, CommitteeActivity, News]), ContentLinksModule, FilesModule],
  controllers: [CommitteesAdminController, CommitteesPublicController],
  providers: [CommitteesService],
})
export class CommitteesModule {}
