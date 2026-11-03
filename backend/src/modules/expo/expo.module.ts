import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { SiteSetting } from '../settings/site-setting.entity';
import { ExpoApplication } from './expo-application.entity';
import { ExpoItem } from './expo-item.entity';
import { ExpoApplicationsAdminController, ExpoItemsAdminController, ExpoPublicController } from './expo.controller';
import { ExpoService } from './expo.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExpoItem, ExpoApplication, SiteSetting]), FilesModule],
  controllers: [ExpoItemsAdminController, ExpoApplicationsAdminController, ExpoPublicController],
  providers: [ExpoService],
})
export class ExpoModule {}
