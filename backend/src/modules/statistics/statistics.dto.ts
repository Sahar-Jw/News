import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));

export class CreateStatisticDto {
  @IsString() @MinLength(1) @MaxLength(150) titleAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) titleEn?: string | null;
  /** typed by hand; when it is empty the chosen real number (metric) is shown */
  @blankToNull() @IsOptional() @IsString() @MaxLength(60) value?: string | null;
  /** key of a real number counted from the database (see statistics.metrics.ts) */
  @blankToNull() @IsOptional() @IsString() @MaxLength(60) metric?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(20) prefix?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(40) suffixAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(40) suffixEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateStatisticDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(150) titleAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) titleEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(60) value?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(60) metric?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(20) prefix?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(40) suffixAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(40) suffixEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class StatisticsAdminQueryDto extends AdminListQueryDto {}

export class PublicStatisticsQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}
