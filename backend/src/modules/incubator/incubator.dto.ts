import { Transform, Type } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { APPLICATION_STATUSES, PROJECT_STAGES } from './incubator-application.entity';
import { PROJECT_STATUSES } from './incubator-project.entity';

// multipart/form-data: every value is a string, and an empty field means "clear it"
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));
const STATUSES = PROJECT_STATUSES as unknown as string[];
const APP_STATUSES = APPLICATION_STATUSES as unknown as string[];

export class CreateProjectDto {
  @IsIn(STATUSES) status: string;
  @IsString() @MinLength(2) @MaxLength(190) nameAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(190) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) sectorAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) sectorEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) founderAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) founderEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) summaryAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) summaryEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) storyAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) storyEn?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1990) @Max(2100) joinedYear?: number | null;
  @blankToNull() @IsOptional() @Matches(/^https?:\/\/\S+$/i, { message: 'website must start with http:// or https://' }) @MaxLength(500) website?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number | null;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  @toBool() @IsOptional() @IsBoolean() removeImage?: boolean;
}
export class UpdateProjectDto {
  @IsOptional() @IsIn(STATUSES) status?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(190) nameAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(190) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) sectorAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) sectorEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) founderAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) founderEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) summaryAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) summaryEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) storyAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) storyEn?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(1990) @Max(2100) joinedYear?: number | null;
  @blankToNull() @IsOptional() @Matches(/^https?:\/\/\S+$/i, { message: 'website must start with http:// or https://' }) @MaxLength(500) website?: string | null;
  @blankToNull() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number | null;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  @toBool() @IsOptional() @IsBoolean() removeImage?: boolean;
}
export class ProjectsAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(STATUSES) status?: string;
}

export class ApplicationsAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(APP_STATUSES) status?: string;
}
export class UpdateApplicationDto {
  @IsOptional() @IsIn(APP_STATUSES) status?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(3000) adminNote?: string | null;
}

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : value));
// multipart/form-data: a checked box arrives as the string "true"
const mustBeTrue = () => Transform(({ value }) => (value === true || value === 'true' || value === '1' || value === 'on' ? true : value));
const THREE_PART_NAME = /^\S+(\s+\S+){2,}$/;

/** public "submit your project" form (multipart: optional project profile / study in the field "profile") */
export class ApplyDto {
  @trim() @IsString() @MinLength(2) @MaxLength(190) projectName: string;
  @trim() @IsString() @Matches(THREE_PART_NAME, { message: 'name must have three parts (first, father, family)' }) @MaxLength(150) founderName: string;
  @trim() @IsEmail() @MaxLength(190) email: string;
  @trim() @IsString() @Matches(/^[+0-9()\-\s]{6,30}$/, { message: 'phone must contain 6–30 digits, spaces, + ( ) or -' }) phone: string;
  /** the field / sector of the project */
  @trim() @IsString() @MinLength(2) @MaxLength(150) sector: string;
  /** idea | prototype | launched  (initial idea / under development / existing project) */
  @IsIn(PROJECT_STAGES as unknown as string[]) stage: string;
  /** short description of the project and its idea */
  @trim() @IsString() @MinLength(10) @MaxLength(5000) description: string;
  @trim() @IsString() @MinLength(10) @MaxLength(5000) feasibility: string;
  @trim() @IsString() @MinLength(2) @MaxLength(3000) targetAudience: string;
  @blankToNull() @trim() @IsOptional() @IsString() @MaxLength(3000) team?: string | null;
  @trim() @IsString() @MinLength(2) @MaxLength(3000) needs: string;
  /** both boxes are mandatory: privacy policy accepted, data confirmed correct */
  @mustBeTrue() @Equals(true, { message: 'the privacy policy must be accepted' }) acceptPrivacy: boolean;
  @mustBeTrue() @Equals(true, { message: 'the correctness of the data must be confirmed' }) confirmData: boolean;
  /** language of the confirmation e-mail */
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}

export class PublicQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}
