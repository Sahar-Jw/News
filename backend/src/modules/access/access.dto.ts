import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoleDto {
  @IsString() @Matches(/^[a-z0-9][a-z0-9_.-]{1,49}$/, { message: 'الرمز: أحرف إنجليزية صغيرة وأرقام و _ . - (2-50)' }) code: string;
  @IsString() @MinLength(2) @MaxLength(100) nameAr: string;
  @IsString() @MinLength(2) @MaxLength(100) nameEn: string;
  @IsOptional() @Type(() => Number) @IsInt() numericValue?: number;
  @IsOptional() @IsString() @MaxLength(100) stringValue?: string;
  @IsOptional() @IsString() @MaxLength(50) type?: string;
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) nameAr?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) nameEn?: string;
  @IsOptional() @Type(() => Number) @IsInt() numericValue?: number;
  @IsOptional() @IsString() @MaxLength(100) stringValue?: string;
  @IsOptional() @IsString() @MaxLength(50) type?: string;
}

export class SetRolePermissionsDto {
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) @MaxLength(100, { each: true }) permissionCodes: string[];
}
