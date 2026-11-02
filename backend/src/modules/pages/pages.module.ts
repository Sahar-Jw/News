import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SitePage } from './page.entity';
import { PagesAdminController, PagesPublicController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({ imports: [TypeOrmModule.forFeature([SitePage])], controllers: [PagesAdminController, PagesPublicController], providers: [PagesService] })
export class PagesModule {}
