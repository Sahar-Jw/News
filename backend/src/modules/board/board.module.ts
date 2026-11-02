import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { BoardMember } from './board-member.entity';
import { BoardAdminController, BoardPublicController } from './board.controller';
import { BoardService } from './board.service';

@Module({ imports: [TypeOrmModule.forFeature([BoardMember]), FilesModule], controllers: [BoardAdminController, BoardPublicController], providers: [BoardService] })
export class BoardModule {}
