import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { BOOKING_KINDS, BOOKING_STATUSES, DURATION_UNITS, SPACE_KINDS } from './get2trade.entity';

const clean = () => Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : value));
// multipart/form-data: every value is a string, and an empty field means "clear it". The raw value is checked because
// @Type(() => Number) has already turned '' into 0 by the time this runs.
const blankToNull = () => Transform(({ value, obj, key }) => { const raw = obj?.[key]; return typeof raw === 'string' && raw.trim() === '' ? null : value; });
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));
const SPACES = SPACE_KINDS as unknown as string[];
const KINDS = BOOKING_KINDS as unknown as string[];
const UNITS = DURATION_UNITS as unknown as string[];
const STATUSES = BOOKING_STATUSES as unknown as string[];

export class UpdateG2tSettingsDto {
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) aboutAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) aboutEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) servicesAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) servicesEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100) newsTopicAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100) newsTopicEn?: string | null;
  @blankToNull() @IsOptional() @IsEmail() @MaxLength(190) notifyEmail?: string | null;
  @toBool() @IsOptional() @IsBoolean() isOpen?: boolean;
}

/** ---------------------------------------------------------------- packages (JSON) */
export class CreatePackageDto {
  @clean() @IsString() @MinLength(2) @MaxLength(150) nameAr: string;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) featuresAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) featuresEn?: string | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) priceAr?: string | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) priceEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdatePackageDto {
  @clean() @IsOptional() @IsString() @MinLength(2) @MaxLength(150) nameAr?: string;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) featuresAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) featuresEn?: string | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) priceAr?: string | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) priceEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/** ---------------------------------------------------------------- spaces (multipart: optional picture in "image") */
export class CreateSpaceDto {
  @IsIn(SPACES) kind: string;
  @clean() @IsString() @MinLength(2) @MaxLength(150) nameAr: string;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) descriptionAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) descriptionEn?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) capacity?: number | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) areaSqm?: number | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) priceAr?: string | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) priceEn?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @toBool() @IsOptional() @IsBoolean() isAvailable?: boolean;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  /** "true" removes the current picture */
  @toBool() @IsOptional() @IsBoolean() removeImage?: boolean;
}
export class UpdateSpaceDto {
  @IsOptional() @IsIn(SPACES) kind?: string;
  @clean() @IsOptional() @IsString() @MinLength(2) @MaxLength(150) nameAr?: string;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) descriptionAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) descriptionEn?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) capacity?: number | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) areaSqm?: number | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) priceAr?: string | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) priceEn?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @toBool() @IsOptional() @IsBoolean() isAvailable?: boolean;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  @toBool() @IsOptional() @IsBoolean() removeImage?: boolean;
}
export class SpacesAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(SPACES) kind?: string;
}

/** ---------------------------------------------------------------- bookings */
export class BookingDto {
  @IsIn(KINDS) kind: string;
  @clean() @IsString() @MinLength(2) @MaxLength(150) name: string;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(150) company?: string | null;
  @clean() @IsString() @Matches(/^[+0-9()\-\s]{6,30}$/, { message: 'phone must contain 6–30 digits, spaces, + ( ) or -' }) phone: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() @MaxLength(190) email: string;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) spaceId?: number | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) packageId?: number | null;
  @blankToNull() @IsOptional() @IsDateString({ strict: true }, { message: 'startDate must be a valid date (YYYY-MM-DD)' }) startDate?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) people?: number | null;
  @blankToNull() @IsOptional() @IsIn(SPACES) spaceKind?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(120) durationValue?: number | null;
  @blankToNull() @IsOptional() @IsIn(UNITS) durationUnit?: string | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(1000) extraServices?: string | null;
  @blankToNull() @clean() @IsOptional() @IsString() @MaxLength(3000) message?: string | null;
}

export class BookingsAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsIn(KINDS) kind?: string;
}
export class UpdateBookingDto {
  @IsOptional() @IsIn(STATUSES) status?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) staffNotes?: string | null;
}

export class PackagesAdminQueryDto extends AdminListQueryDto {}
