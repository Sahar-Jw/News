import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { SERVICE_KINDS } from './service.entity';

// multipart/form-data: every value is a string, and an empty field means "clear it"
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));
const KINDS = SERVICE_KINDS as unknown as string[];
const URL_OPTS = { require_protocol: true, protocols: ['http', 'https'] };

export class CreateServiceDto {
  @IsIn(KINDS) kind: string;
  @IsString() @MinLength(2) @MaxLength(255) nameAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) descriptionAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) descriptionEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(500) audienceAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(500) audienceEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) documentsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) documentsEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) stepsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) stepsEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) locationAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) locationEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) departmentAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) departmentEn?: string | null;
  /** where the responsible department's page / contact is: a full link or a path inside the site (/contact) */
  @blankToNull() @IsOptional() @Matches(/^(https?:\/\/|\/)\S+$/, { message: 'departmentUrl must be a link or a path starting with /' }) @MaxLength(300) departmentUrl?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100) durationAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100) durationEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) feeAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) feeEn?: string | null;
  @blankToNull() @IsOptional() @Matches(/^(https?:\/\/\S+|\/(?![/\\])\S*)$/, { message: 'formUrl must be a link or a path starting with /' }) @MaxLength(500) formUrl?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  /** "true" removes the current picture */
  @toBool() @IsOptional() @IsBoolean() removeImage?: boolean;
}

export class UpdateServiceDto {
  @IsOptional() @IsIn(KINDS) kind?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) nameAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) descriptionAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) descriptionEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(500) audienceAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(500) audienceEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) documentsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) documentsEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) stepsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) stepsEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) locationAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) locationEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) departmentAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) departmentEn?: string | null;
  /** where the responsible department's page / contact is: a full link or a path inside the site (/contact) */
  @blankToNull() @IsOptional() @Matches(/^(https?:\/\/|\/)\S+$/, { message: 'departmentUrl must be a link or a path starting with /' }) @MaxLength(300) departmentUrl?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100) durationAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100) durationEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) feeAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) feeEn?: string | null;
  @blankToNull() @IsOptional() @Matches(/^(https?:\/\/\S+|\/(?![/\\])\S*)$/, { message: 'formUrl must be a link or a path starting with /' }) @MaxLength(500) formUrl?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  @toBool() @IsOptional() @IsBoolean() removeImage?: boolean;
  /** "true" removes the uploaded form file */
  @toBool() @IsOptional() @IsBoolean() removeForm?: boolean;
}

export class ServicesAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(KINDS) kind?: string;
  /** shown on the site / hidden from it */
  @IsOptional() @IsIn(['active', 'hidden']) status?: string;
}

export class PublicServicesQueryDto {
  @IsOptional() @IsIn(KINDS) kind?: string;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}
