import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value));

export class CreateCountryDto {
  /** optional: generated from the English name when omitted */
  @IsOptional() @IsString() @Matches(/^[a-z0-9][a-z0-9_-]{1,49}$/, { message: 'الرمز: أحرف إنجليزية صغيرة وأرقام و _ -' }) code?: string;
  @trim() @IsString() @MinLength(2) @MaxLength(100) nameAr: string;
  @trim() @IsString() @MinLength(2) @MaxLength(100) nameEn: string;
}
