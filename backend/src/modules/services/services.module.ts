import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ServicesAdminController, ServicesPublicController } from './services.controller';
import { ServicesService } from './services.service';

@Module({ imports: [FilesModule], controllers: [ServicesAdminController, ServicesPublicController], providers: [ServicesService] })
export class ServicesModule {}
