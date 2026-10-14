import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './access.dto';
import { RolesService } from './roles.service';

@Controller('admin/roles')
export class RolesController {
  constructor(private readonly service: RolesService) {}

  // The roles list also feeds user-management dropdowns.
  @Get()
  @Permissions(PERM.ROLES_MANAGE, PERM.USERS_READ, PERM.USERS_CREATE, PERM.USERS_UPDATE, PERM.PERMISSIONS_READ, PERM.PERMISSIONS_ASSIGN)
  list() {
    return this.service.list();
  }

  @Post()
  @Permissions(PERM.ROLES_MANAGE)
  create(@Body() dto: CreateRoleDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }

  @Patch(':id')
  @Permissions(PERM.ROLES_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Delete(':id')
  @Permissions(PERM.ROLES_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }

  @Get(':id/permissions')
  @Permissions(PERM.PERMISSIONS_READ, PERM.PERMISSIONS_ASSIGN)
  getPermissions(@Param('id', ParseIntPipe) id: number) {
    return this.service.getRolePermissions(id);
  }

  @Put(':id/permissions')
  @Permissions(PERM.PERMISSIONS_ASSIGN)
  setPermissions(@Param('id', ParseIntPipe) id: number, @Body() dto: SetRolePermissionsDto, @CurrentUser() u: AuthUser) {
    return this.service.setRolePermissions(id, dto, u);
  }
}

@Controller('admin/permissions')
export class PermissionsController {
  constructor(private readonly service: RolesService) {}

  @Get()
  @Permissions(PERM.PERMISSIONS_READ, PERM.PERMISSIONS_ASSIGN)
  list() {
    return this.service.listPermissions();
  }
}
