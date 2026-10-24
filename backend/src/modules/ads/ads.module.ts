import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ad } from './ad.entity';
import { AdsAdminController, AdsPublicController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({ imports: [TypeOrmModule.forFeature([Ad])], controllers: [AdsAdminController, AdsPublicController], providers: [AdsService] })
export class AdsModule {}
