import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { MEMBERSHIP_STATUSES } from './membership.entity';

const clean = () => Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : value));
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
const STATUSES = MEMBERSHIP_STATUSES as unknown as string[];

/** The public form is multipart (documents): every value is a string. */
export class ApplyDto {
  @clean() @IsString() @MinLength(2) @MaxLength(255) companyName: string;
  @clean() @IsString() @MinLength(2) @MaxLength(255) activity: string;
  @clean() @IsString() @MinLength(2) @MaxLength(150) managerName: string;
  @clean() @IsString() @MinLength(5) @MaxLength(50) phone: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() @MaxLength(190) email: string;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(3000) message?: string | null;
}

export class MembershipAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(STATUSES) status?: string;
}

export class UpdateApplicationDto {
  @IsOptional() @IsIn(STATUSES) status?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) staffNotes?: string | null;
}

export class UpdateMembershipSettingsDto {
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) conditionsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) conditionsEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) documentsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) documentsEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) feesAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) feesEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) stepsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) stepsEn?: string | null;
  @blankToNull() @IsOptional() @IsEmail() @MaxLength(190) notifyEmail?: string | null;
  @Transform(({ value }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value)) @IsOptional() isOpen?: boolean;
}
