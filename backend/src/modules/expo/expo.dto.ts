import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { APPLICATION_KINDS, APPLICATION_STATUSES } from './expo-application.entity';
import { EXPO_KINDS } from './expo-item.entity';

// multipart/form-data: every value is a string, and an empty field means "clear it"
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));
const KINDS = EXPO_KINDS as unknown as string[];

export class CreateExpoItemDto {
  @IsIn(KINDS) kind: string;
  @IsString() @MinLength(2) @MaxLength(255) nameAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) descriptionAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) descriptionEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) sectorAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) sectorEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(30) category?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) personAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) personEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) placeAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) placeEn?: string | null;
  @blankToNull() @IsOptional() @IsDateString({ strict: true }, { message: 'startsAt must be a valid date-time' }) startsAt?: string | null;
  @blankToNull() @IsOptional() @IsDateString({ strict: true }, { message: 'endsAt must be a valid date-time' }) endsAt?: string | null;
  @blankToNull() @IsOptional() @Matches(/^https?:\/\/\S+$/i, { message: 'website must start with http:// or https://' }) @MaxLength(500) website?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number | null;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  @toBool() @IsOptional() @IsBoolean() removeLogo?: boolean;
}
export class UpdateExpoItemDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) nameAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) descriptionAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) descriptionEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) sectorAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) sectorEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(30) category?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) personAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) personEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) placeAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) placeEn?: string | null;
  @blankToNull() @IsOptional() @IsDateString({ strict: true }, { message: 'startsAt must be a valid date-time' }) startsAt?: string | null;
  @blankToNull() @IsOptional() @IsDateString({ strict: true }, { message: 'endsAt must be a valid date-time' }) endsAt?: string | null;
  @blankToNull() @IsOptional() @Matches(/^https?:\/\/\S+$/i, { message: 'website must start with http:// or https://' }) @MaxLength(500) website?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number | null;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  @toBool() @IsOptional() @IsBoolean() removeLogo?: boolean;
}
export class ExpoItemsAdminQueryDto extends AdminListQueryDto {
  @IsIn(KINDS) kind: string;
}

export class ApplicationsAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(APPLICATION_KINDS as unknown as string[]) kind?: string;
  @IsOptional() @IsIn(APPLICATION_STATUSES as unknown as string[]) status?: string;
}
export class UpdateApplicationDto {
  @IsOptional() @IsIn(APPLICATION_STATUSES as unknown as string[]) status?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) adminNote?: string | null;
}

/** public form: stand request / visitor registration / information request */
export class ApplyDto {
  @IsIn(APPLICATION_KINDS as unknown as string[]) kind: string;
  @IsString() @MinLength(2) @MaxLength(150) name: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(190) company?: string | null;
  @IsEmail() @MaxLength(190) email: string;
  @IsString() @Matches(/^[+0-9()\-\s]{6,30}$/, { message: 'phone must contain 6–30 digits, spaces, + ( ) or -' }) phone: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) sector?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) message?: string | null;
}

export class PublicItemsQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}
