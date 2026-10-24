import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

const emptyToNull = () => Transform(({ value }) => (value === '' || value === undefined ? null : value));
const numeric = () => Transform(({ value }) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value));
const DATE = { message: 'التاريخ يجب أن يكون بصيغة YYYY-MM-DD' };
const TIME = { message: 'الوقت يجب أن يكون بصيغة HH:MM' };

export class CreateAppointmentDto {
  @numeric() @IsInt() @Min(1) customerId: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, DATE) appointmentDate: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, TIME) appointmentTime: string;
  @IsString() @Matches(/^[A-Za-z0-9_-]{1,50}$/, { message: 'حالة غير صالحة' }) status: string;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(5000) procedures?: string | null;
}

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {}

export class AppointmentsQueryDto extends AdminListQueryDto {
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{1,50}$/) status?: string;
  @IsOptional() @Transform(({ value }) => (value === '' ? undefined : Number(value))) @IsInt() @Min(1) customerId?: number;
}

export class DashboardQueryDto {
  /** the viewer's own "today" (YYYY-MM-DD), so the dashboard follows the browser's day, not the server's */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, DATE) today?: string;
}
