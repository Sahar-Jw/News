import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { Get2TradeAdminController, Get2TradePublicController } from './get2trade.controller';
import { G2tBooking, Get2TradeSettings } from './get2trade.entity';
import { Get2TradeService } from './get2trade.service';

@Module({
  imports: [TypeOrmModule.forFeature([Get2TradeSettings, G2tBooking]), FilesModule],
  controllers: [Get2TradeAdminController, Get2TradePublicController],
  providers: [Get2TradeService],
})
export class Get2TradeModule {}
