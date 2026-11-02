import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MSG = 'الرابط المختصر: أحرف إنجليزية صغيرة وأرقام وشرطات فقط (مثل about)';

export class CreatePageDto {
  @IsString() @MaxLength(100) @Matches(SLUG, { message: SLUG_MSG }) slug: string;
  @IsString() @MinLength(1) @MaxLength(255) titleAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(200000) bodyAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(200000) bodyEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() showInFooter?: boolean;
}

export class UpdatePageDto {
  @IsOptional() @IsString() @MaxLength(100) @Matches(SLUG, { message: SLUG_MSG }) slug?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(200000) bodyAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(200000) bodyEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() showInFooter?: boolean;
}

export class PagesAdminQueryDto extends AdminListQueryDto {}
