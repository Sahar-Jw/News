import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentLinksModule } from '../content-links/content-links.module';
import { News } from '../news/news.entity';
import { FilesModule } from '../files/files.module';
import { BoardMember } from './board-member.entity';
import { BoardAdminController, BoardPublicController } from './board.controller';
import { BoardService } from './board.service';

@Module({ imports: [TypeOrmModule.forFeature([BoardMember, News]), ContentLinksModule, FilesModule], controllers: [BoardAdminController, BoardPublicController], providers: [BoardService] })
export class BoardModule {}
