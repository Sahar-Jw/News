import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from './permission.entity';
import { Role } from './role.entity';
import { RolePermission } from './role-permission.entity';
import { User } from '../users/user.entity';
import { PermissionsService } from './permissions.service';
import { RolesController, PermissionsController } from './access.controller';
import { RolesService } from './roles.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, RolePermission, User])],
  controllers: [RolesController, PermissionsController],
  providers: [PermissionsService, RolesService],
  exports: [PermissionsService, RolesService],
})
export class AccessModule {}
