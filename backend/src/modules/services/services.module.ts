import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { ChamberService } from './service.entity';
import { ServicesAdminController, ServicesPublicController } from './services.controller';
import { ServicesService } from './services.service';

@Module({ imports: [TypeOrmModule.forFeature([ChamberService]), FilesModule], controllers: [ServicesAdminController, ServicesPublicController], providers: [ServicesService] })
export class ServicesModule {}
