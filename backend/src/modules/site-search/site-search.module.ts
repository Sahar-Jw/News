import { Module } from '@nestjs/common';
import { SiteSearchController } from './site-search.controller';
import { SiteSearchService } from './site-search.service';

@Module({ controllers: [SiteSearchController], providers: [SiteSearchService] })
export class SiteSearchModule {}
