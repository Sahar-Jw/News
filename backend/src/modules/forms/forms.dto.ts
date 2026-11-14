import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

const clean = () => Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : value));
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));

export class SaveFormDto {
  @clean() @IsOptional() @IsString() @Matches(/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/, { message: 'الرابط المختصر: أحرف إنكليزية صغيرة وأرقام وشرطات (3 إلى 80)' }) slug?: string;
  @clean() @IsOptional() @IsString() @MinLength(2) @MaxLength(200) titleAr?: string;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(200) titleEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) descriptionAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) descriptionEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(2000) successAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(2000) successEn?: string | null;
  @IsOptional() @IsBoolean() isOpen?: boolean;
  @IsOptional() @IsBoolean() isListed?: boolean;
  /** validated and cleaned field by field in cleanFields() */
  @IsOptional() @IsArray() fields?: any[];
  @IsOptional() @IsArray() statuses?: any[];
  @IsOptional() @IsArray() categories?: any[];
  @IsOptional() @IsArray() integrations?: any[];
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(1000) notifyEmails?: string | null;
  @IsOptional() @IsBoolean() sendReceipt?: boolean;
  @IsOptional() @IsBoolean() requireConsent?: boolean;
  @IsOptional() @Transform(({ value }) => (value === '' ? null : value)) @Type(() => Number) @IsInt() @Min(1) @Max(3650) retentionDays?: number | null;
}

export class DuplicateFormDto {
  @clean() @IsString() @Matches(/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/) slug: string;
}

export class SubmissionsQueryDto extends AdminListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() formId?: number;
  @IsOptional() @IsString() @MaxLength(40) status?: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsString() @MaxLength(10) unread?: string;
}

export class UpdateSubmissionDto {
  @IsOptional() @IsString() @MaxLength(40) status?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(40) category?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) staffNotes?: string | null;
}

export class ContactApplicantDto {
  @clean() @IsString() @MinLength(2) @MaxLength(255) subject: string;
  @clean() @IsString() @MinLength(2) @MaxLength(10000) body: string;
}

export class BulkIdsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @Type(() => Number) @IsInt({ each: true }) ids: number[];
}

export class BulkStatusDto extends BulkIdsDto {
  @IsOptional() @IsString() @MaxLength(40) status?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(40) category?: string | null;
}

/** multipart body of the public form: answers as one JSON string, the files under f_<fieldKey> */
export class SubmitFormDto {
  @IsString() @MaxLength(200000) data: string;
  @IsOptional() @IsString() @MaxLength(10) consent?: string;
  /** honeypot: a real person never fills it */
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsString() @MaxLength(2) lang?: string;
}
