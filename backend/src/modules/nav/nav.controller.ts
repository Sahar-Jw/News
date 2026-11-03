import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { PublicNavQueryDto, SaveNavDto } from './nav.dto';
import { NavService } from './nav.service';

@Controller('admin/nav')
export class NavAdminController {
  constructor(private readonly service: NavService) {}

  @Get()
  @Permissions(PERM.NAV_READ)
  tree() {
    return this.service.adminTree();
  }

  @Put()
  @Permissions(PERM.NAV_UPDATE)
  save(@Body() dto: SaveNavDto, @CurrentUser() u: AuthUser) {
    return this.service.save(dto, u);
  }
}

@Controller('public/nav')
export class NavPublicController {
  constructor(private readonly service: NavService) {}

  @Public()
  @Get()
  tree(@Query() q: PublicNavQueryDto) {
    return this.service.publicTree(q.lang === 'en' ? 'en' : 'ar');
  }
}
