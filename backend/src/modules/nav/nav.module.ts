import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NavAdminController, NavPublicController } from './nav.controller';
import { NavGroup, NavItem } from './nav.entity';
import { NavService } from './nav.service';

@Module({ imports: [TypeOrmModule.forFeature([NavGroup, NavItem])], controllers: [NavAdminController, NavPublicController], providers: [NavService] })
export class NavModule {}
