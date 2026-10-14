import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const lower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
const nullIfEmpty = () => Transform(({ value }) => (value === '' ? null : value));
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === 1 || value === '1' ? true : value === 'false' || value === false || value === 0 || value === '0' ? false : value));
const PHONE = /^[0-9+()\-\s]{5,30}$/;

export class UserListQueryDto extends AdminListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() roleId?: number;
  @IsOptional() @toBool() @IsBoolean() isActive?: boolean;
}

export class CreateUserDto {
  @trim() @IsString() @MinLength(2) @MaxLength(150) fullName: string;
  @lower() @IsEmail() @MaxLength(190) email: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
  @Type(() => Number) @IsInt() roleId: number;
  @IsOptional() @nullIfEmpty() @Matches(PHONE, { message: 'رقم هاتف غير صالح' }) phone?: string;
  @IsOptional() @toBool() @IsBoolean() isActive?: boolean;
}

export class UpdateUserDto {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(150) fullName?: string;
  @IsOptional() @lower() @IsEmail() @MaxLength(190) email?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(72) password?: string;
  @IsOptional() @Type(() => Number) @IsInt() roleId?: number;
  @IsOptional() @nullIfEmpty() @Matches(PHONE, { message: 'رقم هاتف غير صالح' }) phone?: string;
  @IsOptional() @toBool() @IsBoolean() isActive?: boolean;
}

export class ActivateUserDto {
  @IsOptional() @toBool() @IsBoolean() active?: boolean;
}

export class BulkIdsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @Type(() => Number) @IsInt({ each: true }) ids: number[];
}

export class UpdateProfileDto {
  @IsOptional() @trim() @IsString() @MinLength(2) @MaxLength(150) fullName?: string;
  @IsOptional() @nullIfEmpty() @Matches(PHONE, { message: 'رقم هاتف غير صالح' }) phone?: string | null;
  @IsOptional() @nullIfEmpty() @IsIn(['male', 'female']) gender?: 'male' | 'female' | null;
  @IsOptional() @nullIfEmpty() @IsString() @MaxLength(100) country?: string | null;
  @IsOptional() @nullIfEmpty() @Type(() => Number) @IsInt() cityId?: number | null;
  @IsOptional() @nullIfEmpty() @IsString() @MaxLength(100) nationality?: string | null;
  @IsOptional() @nullIfEmpty() @IsString() @MaxLength(5000) bio?: string | null;
  @IsOptional() @nullIfEmpty() @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { message: 'رابط غير صالح' }) @MaxLength(500) socialLink?: string | null;
  @IsOptional() @toBool() @IsBoolean() isExpert?: boolean;
  @IsOptional() @toBool() @IsBoolean() isResearcher?: boolean;
}

export class ChangePasswordDto {
  @IsString() @MaxLength(72) currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(72) newPassword: string;
}
