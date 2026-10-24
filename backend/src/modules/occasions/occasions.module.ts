import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Occasion } from './occasion.entity';
import { OccasionsAdminController, OccasionsPublicController } from './occasions.controller';
import { OccasionsService } from './occasions.service';

@Module({ imports: [TypeOrmModule.forFeature([Occasion])], controllers: [OccasionsAdminController, OccasionsPublicController], providers: [OccasionsService] })
export class OccasionsModule {}
