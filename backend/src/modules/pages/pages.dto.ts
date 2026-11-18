import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
// multipart/form-data (the about page can carry a picture): every value is a string
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));
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
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  @toBool() @IsOptional() @IsBoolean() showInFooter?: boolean;
  /** the text shown next to the picture at the bottom of the page, one per language */
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) sideTextAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) sideTextEn?: string | null;
  /** true = delete the current picture (ignored when a new one is uploaded) */
  @toBool() @IsOptional() @IsBoolean() removePhoto?: boolean;
}

export class PagesAdminQueryDto extends AdminListQueryDto {}
