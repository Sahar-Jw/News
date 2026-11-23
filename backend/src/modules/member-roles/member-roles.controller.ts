import { Body, Controller, Get, Put } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject } from 'class-validator';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { MemberRolesService, RoleOption, RoleScope } from './member-roles.service';

/** the global pipe strips undecorated properties, so `options` needs its validators; each item is checked in detail by the service */
class SaveRolesBody {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @IsObject({ each: true }) options: Array<Partial<RoleOption>>;
}

/** The positions of each page, edited in that page's own settings: board (Board of directors), committee (Committees & sectors), women. */
@Controller('admin/member-roles')
export class MemberRolesAdminController {
  constructor(private readonly service: MemberRolesService) {}

  private read(scope: RoleScope) { return this.service.get(scope); }
  private write(scope: RoleScope, body: SaveRolesBody, u: AuthUser) { return this.service.save(scope, body?.options as RoleOption[], u); }

  @Get('board') @Permissions(PERM.BOARD_READ) readBoard() { return this.read('board'); }
  @Put('board') @Permissions(PERM.BOARD_UPDATE) saveBoard(@Body() b: SaveRolesBody, @CurrentUser() u: AuthUser) { return this.write('board', b, u); }

  @Get('committee') @Permissions(PERM.COMMITTEES_READ) readCommittee() { return this.read('committee'); }
  @Put('committee') @Permissions(PERM.COMMITTEES_UPDATE) saveCommittee(@Body() b: SaveRolesBody, @CurrentUser() u: AuthUser) { return this.write('committee', b, u); }

  @Get('women') @Permissions(PERM.COMMITTEES_READ) readWomen() { return this.read('women'); }
  @Put('women') @Permissions(PERM.COMMITTEES_UPDATE) saveWomen(@Body() b: SaveRolesBody, @CurrentUser() u: AuthUser) { return this.write('women', b, u); }
}

@Controller('public/member-roles')
export class MemberRolesPublicController {
  constructor(private readonly service: MemberRolesService) {}

  /** { board: [...], committee: [...], women: [...] }: key + Arabic and English name, in hierarchy order */
  @Public()
  @Get()
  all() {
    return this.service.all();
  }
}
