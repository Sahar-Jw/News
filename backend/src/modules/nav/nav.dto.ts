import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from 'class-validator';

const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));

/** a site path ("/news", "/pages/about", "/#sec-contact") or a full http(s) address; no spaces, no "//host" shortcuts, no javascript: */
export const NAV_URL = /^(\/(?!\/)\S*|https?:\/\/\S+)$/i;

export class NavItemDto {
  @IsString() @MinLength(1) @MaxLength(150) titleAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) titleEn?: string | null;
  @IsString() @MaxLength(500) @Matches(NAV_URL, { message: 'الرابط يجب أن يكون مساراً داخل الموقع يبدأ بـ / أو رابطاً كاملاً http(s)' }) url: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() newTab?: boolean;
  @IsOptional() @IsBoolean() custom?: boolean;
}

export class NavGroupDto {
  @IsString() @MinLength(1) @MaxLength(150) titleAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) titleEn?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  /** a standalone link in the bar (exactly one item) instead of a dropdown */
  @IsOptional() @IsBoolean() single?: boolean;
  @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => NavItemDto) items: NavItemDto[];
}

/** The whole menu in its final order; saving replaces what is stored. */
export class SaveNavDto {
  @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => NavGroupDto) groups: NavGroupDto[];
}

export class PublicNavQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}
