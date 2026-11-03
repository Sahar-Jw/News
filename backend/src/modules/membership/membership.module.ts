import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { MembershipAdminController, MembershipPublicController } from './membership.controller';
import { MembershipApplication, MembershipFile, MembershipSettings } from './membership.entity';
import { MembershipService } from './membership.service';

@Module({
  imports: [TypeOrmModule.forFeature([MembershipApplication, MembershipFile, MembershipSettings]), FilesModule],
  controllers: [MembershipAdminController, MembershipPublicController],
  providers: [MembershipService],
})
export class MembershipModule {}
