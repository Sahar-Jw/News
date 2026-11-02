import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { Document } from './document.entity';
import { DocumentsAdminController, DocumentsPublicController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({ imports: [TypeOrmModule.forFeature([Document]), FilesModule], controllers: [DocumentsAdminController, DocumentsPublicController], providers: [DocumentsService] })
export class DocumentsModule {}
