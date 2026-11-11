import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { IsEmail, MaxLength } from 'class-validator';
import { PERM } from '../../common/constants';
import { Permissions } from '../../common/decorators';
import { MailService } from './mail.service';

class MailTestDto {
  @IsEmail() @MaxLength(190) to: string;
}

/** Admin check of the mail set-up: what is configured, and a real test message with the exact error when it fails. */
@Controller('admin/mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get('status')
  @Permissions(PERM.SETTINGS_READ)
  status() {
    return this.mail.status();
  }

  @Post('test')
  @HttpCode(200)
  @Permissions(PERM.SETTINGS_UPDATE)
  test(@Body() dto: MailTestDto) {
    return this.mail.test(dto.to.trim());
  }
}
