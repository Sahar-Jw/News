import { Module } from '@nestjs/common';
import { OccasionsAdminController, OccasionsPublicController } from './occasions.controller';
import { OccasionsService } from './occasions.service';

@Module({ controllers: [OccasionsAdminController, OccasionsPublicController], providers: [OccasionsService] })
export class OccasionsModule {}
