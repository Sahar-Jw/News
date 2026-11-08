import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { PublicFooterQueryDto, SaveFooterDto } from './footer.dto';
import { FooterService } from './footer.service';

@Controller('admin/footer')
export class FooterAdminController {
  constructor(private readonly service: FooterService) {}

  @Get()
  @Permissions(PERM.FOOTER_READ)
  tree() {
    return this.service.adminTree();
  }

  @Put()
  @Permissions(PERM.FOOTER_UPDATE)
  save(@Body() dto: SaveFooterDto, @CurrentUser() u: AuthUser) {
    return this.service.save(dto, u);
  }
}

@Controller('public/footer')
export class FooterPublicController {
  constructor(private readonly service: FooterService) {}

  @Public()
  @Get()
  tree(@Query() q: PublicFooterQueryDto) {
    return this.service.publicTree(q.lang === 'en' ? 'en' : 'ar');
  }
}
