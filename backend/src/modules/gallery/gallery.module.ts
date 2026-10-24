import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gallery } from './gallery.entity';
import { GalleryAdminController, GalleryPublicController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({ imports: [TypeOrmModule.forFeature([Gallery])], controllers: [GalleryAdminController, GalleryPublicController], providers: [GalleryService] })
export class GalleryModule {}
