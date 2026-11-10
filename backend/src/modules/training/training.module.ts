import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { SiteSetting } from '../settings/site-setting.entity';
import { CourseRegistration } from './course-registration.entity';
import { TrainerApplication } from './trainer-application.entity';
import { CoursesAdminController, RegistrationsAdminController, TrainerApplicationsAdminController, TrainersAdminController, TrainingPublicController } from './training.controller';
import { TrainerApplicationsService } from './trainer-applications.service';
import { TrainersService } from './trainers.service';
import { TrainingService } from './training.service';

@Module({
  imports: [TypeOrmModule.forFeature([CourseRegistration, TrainerApplication, SiteSetting]), FilesModule],
  controllers: [CoursesAdminController, TrainersAdminController, RegistrationsAdminController, TrainerApplicationsAdminController, TrainingPublicController],
  providers: [TrainingService, TrainersService, TrainerApplicationsService],
})
export class TrainingModule {}
