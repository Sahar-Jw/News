import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from '../news/news.entity';
import { ContentStore } from './content.store';

@Global()
@Module({ imports: [TypeOrmModule.forFeature([News])], providers: [ContentStore], exports: [ContentStore] })
export class ContentModule {}
