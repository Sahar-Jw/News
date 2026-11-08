import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FooterAdminController, FooterPublicController } from './footer.controller';
import { FooterGroup, FooterLink } from './footer.entity';
import { FooterService } from './footer.service';

@Module({
  imports: [TypeOrmModule.forFeature([FooterGroup, FooterLink])],
  controllers: [FooterAdminController, FooterPublicController],
  providers: [FooterService],
})
export class FooterModule {}
