import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from '../customers/customer.entity';
import { SiteSetting } from '../settings/site-setting.entity';
import { Appointment } from './appointment.entity';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({ imports: [TypeOrmModule.forFeature([Appointment, Customer, SiteSetting])], controllers: [AppointmentsController], providers: [AppointmentsService] })
export class AppointmentsModule {}
