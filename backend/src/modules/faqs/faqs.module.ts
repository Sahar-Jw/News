import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Faq } from './faq.entity';
import { FaqsAdminController, FaqsPublicController } from './faqs.controller';
import { FaqsService } from './faqs.service';

@Module({ imports: [TypeOrmModule.forFeature([Faq])], controllers: [FaqsAdminController, FaqsPublicController], providers: [FaqsService] })
export class FaqsModule {}
