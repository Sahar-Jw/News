import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { ACTIVITY_KINDS, COMMITTEE_KINDS, EVENT_TYPES, MEMBER_ROLES } from './committee.entity';

// committees and members are multipart (picture): every value is a string
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));
const KINDS = COMMITTEE_KINDS as unknown as string[];
const ROLES = MEMBER_ROLES as unknown as string[];
const ACTS = ACTIVITY_KINDS as unknown as string[];
const EVENT_KINDS = EVENT_TYPES as unknown as string[];

export class CreateCommitteeDto {
  @IsIn(KINDS) kind: string;
  @IsString() @MinLength(1) @MaxLength(255) nameAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) summaryAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) summaryEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) dutiesAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) dutiesEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) chairNameAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) chairNameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) activityTagsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) activityTagsEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCommitteeDto {
  @IsOptional() @IsIn(KINDS) kind?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) nameAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) summaryAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) summaryEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) dutiesAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) dutiesEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) chairNameAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) chairNameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) activityTagsAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) activityTagsEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  /** true = delete the current logo (ignored when a new one is uploaded) */
  @toBool() @IsOptional() @IsBoolean() removeLogo?: boolean;
}

export class CommitteeAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(KINDS) kind?: string;
}

export class CreateMemberDto {
  @IsIn(ROLES) role: string;
  @IsString() @MinLength(1) @MaxLength(255) nameAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) titleAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
}

export class UpdateMemberDto {
  @IsOptional() @IsIn(ROLES) role?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) nameAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) titleAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @toBool() @IsOptional() @IsBoolean() removePhoto?: boolean;
}

// activities: JSON or multipart (the optional picture); in multipart every value is a string
export class CreateActivityDto {
  @IsIn(ACTS) kind: string;
  @IsString() @MinLength(1) @MaxLength(255) titleAr: string;
  @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) bodyAr?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) bodyEn?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) goalsAr?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) goalsEn?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) resultsAr?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) resultsEn?: string | null;
  @blankToNull() @IsOptional() @IsDateString() eventDate?: string | null;
  /** last day of an initiative / activity that runs for several days (empty = a one-day item); never before eventDate */
  @blankToNull() @IsOptional() @IsDateString() endDate?: string | null;
  /** a person / project line (success stories) or a partner (initiatives) */
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) subtitleAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) subtitleEn?: string | null;
  /** only for events: gathering / workshop / expo */
  @blankToNull() @IsOptional() @IsIn(EVENT_KINDS) eventType?: string | null;
  /** archived items stay on the site, in its archive page */
  @toBool() @IsOptional() @IsBoolean() archived?: boolean;
}

export class UpdateActivityDto {
  @IsOptional() @IsIn(ACTS) kind?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleAr?: string;
  @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) bodyAr?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) bodyEn?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) goalsAr?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) goalsEn?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) resultsAr?: string | null;
  @IsOptional() @IsString() @MaxLength(100000) resultsEn?: string | null;
  @blankToNull() @IsOptional() @IsDateString() eventDate?: string | null;
  @blankToNull() @IsOptional() @IsDateString() endDate?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) subtitleAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) subtitleEn?: string | null;
  @blankToNull() @IsOptional() @IsIn(EVENT_KINDS) eventType?: string | null;
  @toBool() @IsOptional() @IsBoolean() archived?: boolean;
  /** true = delete the current picture (ignored when a new one is uploaded) */
  @toBool() @IsOptional() @IsBoolean() removeImage?: boolean;
}

export class LinkNewsDto {
  @IsArray() @Type(() => Number) @IsInt({ each: true }) newsIds: number[];
}

export class PublicCommitteesQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() lang?: string;
}
