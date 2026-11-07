import { Module } from '@nestjs/common';
import { PagesAdminController, PagesPublicController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({ controllers: [PagesAdminController, PagesPublicController], providers: [PagesService] })
export class PagesModule {}
