import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto, PublicListQueryDto } from '../../common/dto/list-query.dto';
import { COURSE_KINDS } from './course.entity';

// multipart/form-data: every value is a string, and an empty field means "clear it"
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));
const KINDS = COURSE_KINDS as unknown as string[];

/** ---------------------------------------------------------------- trainers */
export class CreateTrainerDto {
  @IsString() @MinLength(2) @MaxLength(150) nameAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) bioAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) bioEn?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateTrainerDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) nameAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) bioAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) bioEn?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class TrainersAdminQueryDto extends AdminListQueryDto {}

/** ---------------------------------------------------------------- courses (multipart: optional picture in "image") */
export class CreateCourseDto {
  @IsIn(KINDS) kind: string;
  @IsString() @MinLength(2) @MaxLength(255) nameAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) fieldAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) fieldEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) topicsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) topicsEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) audienceAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) audienceEn?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) trainerId?: number | null;
  @IsDateString({ strict: true }, { message: 'startDate must be a valid date (YYYY-MM-DD)' }) startDate: string;
  @blankToNull() @IsOptional() @IsDateString({ strict: true }, { message: 'endDate must be a valid date (YYYY-MM-DD)' }) endDate?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) hours?: number | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) locationAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) locationEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) feeAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) feeEn?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) capacity?: number | null;
  @toBool() @IsOptional() @IsBoolean() registrationClosed?: boolean;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  /** "true" removes the current picture */
  @toBool() @IsOptional() @IsBoolean() removeImage?: boolean;
}
export class UpdateCourseDto {
  @IsOptional() @IsIn(KINDS) kind?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) nameAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) fieldAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) fieldEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) topicsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) topicsEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) audienceAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) audienceEn?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) trainerId?: number | null;
  @IsOptional() @IsDateString({ strict: true }, { message: 'startDate must be a valid date (YYYY-MM-DD)' }) startDate?: string;
  @blankToNull() @IsOptional() @IsDateString({ strict: true }, { message: 'endDate must be a valid date (YYYY-MM-DD)' }) endDate?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2000) hours?: number | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) locationAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) locationEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) feeAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) feeEn?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) capacity?: number | null;
  @toBool() @IsOptional() @IsBoolean() registrationClosed?: boolean;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  @toBool() @IsOptional() @IsBoolean() removeImage?: boolean;
}
export class CoursesAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(KINDS) kind?: string;
  /** current = not finished yet, archive = finished */
  @IsOptional() @IsIn(['current', 'archive']) scope?: string;
}

/** ---------------------------------------------------------------- registrations */
export class RegistrationsAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) courseId?: number;
}

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(150) name: string;
  @IsEmail() @MaxLength(190) email: string;
  @IsString() @Matches(/^[+0-9()\-\s]{6,30}$/, { message: 'phone must contain 6–30 digits, spaces, + ( ) or -' }) phone: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) organization?: string | null;
}

/** ---------------------------------------------------------------- public */
export class PublicCoursesQueryDto extends PublicListQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
  /** current (default) = not finished yet, archive = finished */
  @IsOptional() @IsIn(['current', 'archive']) scope?: string;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1990) @Max(2100) year?: number;
  @IsOptional() @IsString() @MaxLength(150) field?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) trainerId?: number;
  @IsOptional() @IsIn(KINDS) kind?: string;
}
