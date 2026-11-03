import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { SiteSetting } from '../settings/site-setting.entity';
import { CourseRegistration } from './course-registration.entity';
import { Course } from './course.entity';
import { Trainer } from './trainer.entity';
import { CoursesAdminController, RegistrationsAdminController, TrainersAdminController, TrainingPublicController } from './training.controller';
import { TrainersService } from './trainers.service';
import { TrainingService } from './training.service';

@Module({
  imports: [TypeOrmModule.forFeature([Course, Trainer, CourseRegistration, SiteSetting]), FilesModule],
  controllers: [CoursesAdminController, TrainersAdminController, RegistrationsAdminController, TrainingPublicController],
  providers: [TrainingService, TrainersService],
})
export class TrainingModule {}
