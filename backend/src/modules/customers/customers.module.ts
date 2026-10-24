import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '../appointments/appointment.entity';
import { Customer } from './customer.entity';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({ imports: [TypeOrmModule.forFeature([Customer, Appointment])], controllers: [CustomersController], providers: [CustomersService] })
export class CustomersModule {}
