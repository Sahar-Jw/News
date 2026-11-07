import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { SiteSetting } from '../settings/site-setting.entity';
import { IncubatorApplication } from './incubator-application.entity';
import { IncubatorApplicationsAdminController, IncubatorProjectsAdminController, IncubatorPublicController } from './incubator.controller';
import { IncubatorService } from './incubator.service';

@Module({
  imports: [TypeOrmModule.forFeature([IncubatorApplication, SiteSetting]), FilesModule],
  controllers: [IncubatorProjectsAdminController, IncubatorApplicationsAdminController, IncubatorPublicController],
  providers: [IncubatorService],
})
export class IncubatorModule {}
