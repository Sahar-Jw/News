import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { APPLICATION_KINDS, APPLICATION_STATUSES, BOOTH_TYPES, INQUIRY_TYPES, VISIT_INTERESTS } from './expo-application.entity';
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
  /** position of an exhibitor on the floor plan image, percent (0-100) */
  @blankToNull() @IsOptional() @Type(() => Number) @Min(0) @Max(100) mapX?: number | null;
  @blankToNull() @IsOptional() @Type(() => Number) @Min(0) @Max(100) mapY?: number | null;
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
  /** position of an exhibitor on the floor plan image, percent (0-100) */
  @blankToNull() @IsOptional() @Type(() => Number) @Min(0) @Max(100) mapX?: number | null;
  @blankToNull() @IsOptional() @Type(() => Number) @Min(0) @Max(100) mapY?: number | null;
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

/**
 * Public forms (multipart, because the exhibitor form can carry the company profile file).
 * exhibitor: company, contact person, job title, phone, e-mail, country, city, business field, products, area, booth type, notes, profile (optional)
 * visitor: three-part name, company (optional), job title, phone, e-mail, country, city, field, interest
 * info: three-part name, company (optional), phone, e-mail, inquiry type, inquiry text
 */
export class ApplyDto {
  @IsIn(APPLICATION_KINDS as unknown as string[]) kind: string;
  @IsString() @MinLength(2) @MaxLength(150) name: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(190) company?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) jobTitle?: string | null;
  @IsEmail() @MaxLength(190) email: string;
  @IsString() @Matches(/^[+0-9()\-\s]{6,30}$/, { message: 'phone must contain 6–30 digits, spaces, + ( ) or -' }) phone: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100) country?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100) city?: string | null;
  /** business field (exhibitor, visitor) */
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) sector?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) products?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(40) area?: string | null;
  @blankToNull() @IsOptional() @IsIn(BOOTH_TYPES as unknown as string[]) participationType?: string | null;
  @blankToNull() @IsOptional() @IsIn(VISIT_INTERESTS as unknown as string[]) interest?: string | null;
  @blankToNull() @IsOptional() @IsIn(INQUIRY_TYPES as unknown as string[]) inquiryType?: string | null;
  /** notes (exhibitor) or the inquiry text (info) */
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) message?: string | null;
}

export class PublicItemsQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}
