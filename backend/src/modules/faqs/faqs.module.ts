import { Module } from '@nestjs/common';
import { FaqsAdminController, FaqsPublicController } from './faqs.controller';
import { FaqsService } from './faqs.service';

@Module({ controllers: [FaqsAdminController, FaqsPublicController], providers: [FaqsService] })
export class FaqsModule {}
