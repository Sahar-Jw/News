import { Controller, Get, Query } from '@nestjs/common';
import { SiteSearchQueryDto } from './site-search.dto';
import { SiteSearchService } from './site-search.service';

@Controller('public/site-search')
export class SiteSearchController {
  constructor(private readonly service: SiteSearchService) {}

  /** The site-wide search outside the news: events, documents, committees, services, courses, projects, FAQs, pages ... */
  @Get()
  search(@Query() q: SiteSearchQueryDto) {
    return this.service.search(q);
  }
}
