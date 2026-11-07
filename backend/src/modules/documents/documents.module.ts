import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { DocumentsAdminController, DocumentsPublicController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({ imports: [FilesModule], controllers: [DocumentsAdminController, DocumentsPublicController], providers: [DocumentsService] })
export class DocumentsModule {}
