import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesModule } from '../files/files.module';
import { FormsAdminController, FormsPublicController } from './forms.controller';
import { FormDefinition, FormSubmission, FormSubmissionFile, FormSubmissionMessage } from './forms.entity';
import { FormsService } from './forms.service';
import { FormsWebhookService } from './forms-webhook.service';

/** Dashboard-managed forms: builder, public submit with files, review / classify / contact, Excel export, retention and signed webhooks. */
@Module({
  imports: [TypeOrmModule.forFeature([FormDefinition, FormSubmission, FormSubmissionFile, FormSubmissionMessage]), FilesModule],
  controllers: [FormsAdminController, FormsPublicController],
  providers: [FormsService, FormsWebhookService],
  exports: [FormsService],
})
export class FormsModule {}
