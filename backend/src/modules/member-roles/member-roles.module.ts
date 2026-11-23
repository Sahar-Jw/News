import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteSetting } from '../settings/site-setting.entity';
import { MemberRolesAdminController, MemberRolesPublicController } from './member-roles.controller';
import { MemberRolesService } from './member-roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([SiteSetting])],
  controllers: [MemberRolesAdminController, MemberRolesPublicController],
  providers: [MemberRolesService],
  exports: [MemberRolesService],
})
export class MemberRolesModule {}
