import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCityDto {
  /** optional: generated from the English name when omitted */
  @IsOptional() @IsString() @Matches(/^[a-z0-9][a-z0-9_-]{1,49}$/, { message: 'الرمز: أحرف إنجليزية صغيرة وأرقام و _ -' }) code?: string;
  @IsString() @MinLength(2) @MaxLength(100) nameAr: string;
  @IsString() @MinLength(2) @MaxLength(100) nameEn: string;
  @IsOptional() @Type(() => Number) @IsInt() numericValue?: number;
  @IsOptional() @IsString() @MaxLength(100) stringValue?: string;
  @IsOptional() @IsString() @MaxLength(50) type?: string;
}

export class UpdateCityDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) nameAr?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) nameEn?: string;
  @IsOptional() @Type(() => Number) @IsInt() numericValue?: number;
  @IsOptional() @IsString() @MaxLength(100) stringValue?: string;
  @IsOptional() @IsString() @MaxLength(50) type?: string;
}
