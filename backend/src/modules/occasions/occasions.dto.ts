import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { parseStringList } from '../../common/dto/form-transforms';
import { AdminListQueryDto, PublicListQueryDto } from '../../common/dto/list-query.dto';

export const EVENT_NEWS_KINDS = ['news', 'visit', 'meeting', 'participation', 'activity', 'coverage'] as const;

/** multipart sends the coverage list as a JSON string; entries without a valid http(s) url are dropped. */
function parseCoverage({ value }: { value: unknown }) {
  let v: unknown = value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return undefined; } }
  if (!Array.isArray(v)) return undefined;
  return v.map((x: any) => ({ title: String(x?.title ?? '').slice(0, 255), url: String(x?.url ?? '').trim().slice(0, 500), source: String(x?.source ?? '').slice(0, 150) })).filter((x) => /^https?:\/\//i.test(x.url));
}

export class CreateOccasionDto {
  @IsString() @MinLength(1) @MaxLength(255) titleAr: string;
  @IsString() @MinLength(1) @MaxLength(255) titleEn: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'التاريخ يجب أن يكون بصيغة YYYY-MM-DD' }) eventDate: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ النهاية يجب أن يكون بصيغة YYYY-MM-DD' }) finishDate: string;
  @IsOptional() @IsIn(['occasion', 'exhibition']) type?: string;

  /** Event details (all optional; stored in news.extra). */
  @IsOptional() @IsString() @MaxLength(6000) descriptionAr?: string;
  @IsOptional() @IsString() @MaxLength(6000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(255) locationAr?: string;
  @IsOptional() @IsString() @MaxLength(255) locationEn?: string;
  @IsOptional() @IsString() @MaxLength(150) sectorAr?: string;
  @IsOptional() @IsString() @MaxLength(150) sectorEn?: string;
  @IsOptional() @IsString() @MaxLength(200) organizerAr?: string;
  @IsOptional() @IsString() @MaxLength(200) organizerEn?: string;
  /** Agenda details (all optional, '' = not set). Times are 24-hour HH:MM. */
  @IsOptional() @Matches(/^(([01]\d|2[0-3]):[0-5]\d)?$/, { message: 'الوقت يجب أن يكون بصيغة HH:MM' }) startTime?: string;
  @IsOptional() @Matches(/^(([01]\d|2[0-3]):[0-5]\d)?$/, { message: 'الوقت يجب أن يكون بصيغة HH:MM' }) endTime?: string;
  @IsOptional() @IsString() @MaxLength(255) audienceAr?: string;
  @IsOptional() @IsString() @MaxLength(255) audienceEn?: string;
  /** link of the registration page; must be http(s) */
  @IsOptional() @Matches(/^(https?:\/\/\S{1,480})?$/i, { message: 'رابط التسجيل غير صالح' }) registrationUrl?: string;
  @IsOptional() @IsString() @MaxLength(255) registrationNoteAr?: string;
  @IsOptional() @IsString() @MaxLength(255) registrationNoteEn?: string;
  /** organized = the Chamber organizes it, participating = the Chamber takes part in it; '' = not set */
  @IsOptional() @IsIn(['organized', 'participating', '']) participation?: string;
  /** related exhibition (for an occasion that belongs to an exhibition); 0 = none */
  @IsOptional() @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value))) @IsInt() @Min(0) parentId?: number;
  /** YouTube links (JSON string in multipart) */
  @IsOptional() @Transform(parseStringList) @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) videos?: string[];
  /** media coverage links: JSON [{title,url,source}] */
  @IsOptional() @Transform(parseCoverage) @IsArray() @ArrayMaxSize(30) coverage?: { title: string; url: string; source: string }[];
}

export class UpdateOccasionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleAr?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleEn?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'التاريخ يجب أن يكون بصيغة YYYY-MM-DD' }) eventDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ النهاية يجب أن يكون بصيغة YYYY-MM-DD' }) finishDate?: string;
  @IsOptional() @IsIn(['occasion', 'exhibition']) type?: string;

  /** Event details (all optional; stored in news.extra). */
  @IsOptional() @IsString() @MaxLength(6000) descriptionAr?: string;
  @IsOptional() @IsString() @MaxLength(6000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(255) locationAr?: string;
  @IsOptional() @IsString() @MaxLength(255) locationEn?: string;
  @IsOptional() @IsString() @MaxLength(150) sectorAr?: string;
  @IsOptional() @IsString() @MaxLength(150) sectorEn?: string;
  @IsOptional() @IsString() @MaxLength(200) organizerAr?: string;
  @IsOptional() @IsString() @MaxLength(200) organizerEn?: string;
  /** Agenda details (all optional, '' = not set). Times are 24-hour HH:MM. */
  @IsOptional() @Matches(/^(([01]\d|2[0-3]):[0-5]\d)?$/, { message: 'الوقت يجب أن يكون بصيغة HH:MM' }) startTime?: string;
  @IsOptional() @Matches(/^(([01]\d|2[0-3]):[0-5]\d)?$/, { message: 'الوقت يجب أن يكون بصيغة HH:MM' }) endTime?: string;
  @IsOptional() @IsString() @MaxLength(255) audienceAr?: string;
  @IsOptional() @IsString() @MaxLength(255) audienceEn?: string;
  /** link of the registration page; must be http(s) */
  @IsOptional() @Matches(/^(https?:\/\/\S{1,480})?$/i, { message: 'رابط التسجيل غير صالح' }) registrationUrl?: string;
  @IsOptional() @IsString() @MaxLength(255) registrationNoteAr?: string;
  @IsOptional() @IsString() @MaxLength(255) registrationNoteEn?: string;
  /** organized = the Chamber organizes it, participating = the Chamber takes part in it; '' = not set */
  @IsOptional() @IsIn(['organized', 'participating', '']) participation?: string;
  /** related exhibition (for an occasion that belongs to an exhibition); 0 = none */
  @IsOptional() @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value))) @IsInt() @Min(0) parentId?: number;
  /** YouTube links (JSON string in multipart) */
  @IsOptional() @Transform(parseStringList) @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) videos?: string[];
  /** media coverage links: JSON [{title,url,source}] */
  @IsOptional() @Transform(parseCoverage) @IsArray() @ArrayMaxSize(30) coverage?: { title: string; url: string; source: string }[];
  /** saved images to keep (JSON string in multipart); omitted = keep all */
  @IsOptional() @Transform(parseStringList) @IsArray() @IsString({ each: true }) keepImages?: string[];
}

export class OccasionsAdminQueryDto extends AdminListQueryDto {
  /** optional filter of the occasions table: only upcoming (date today or later) or only previous */
  @IsOptional() @IsIn(['upcoming', 'current', 'previous', 'exhibitions']) status?: string;
  @IsOptional() @IsIn(['occasion', 'exhibition']) type?: string;
  @IsOptional() @IsIn(['organized', 'participating']) participation?: string;
}

export class PublicOccasionsQueryDto extends PublicListQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
  @IsOptional() @IsIn(['all', 'upcoming', 'current', 'previous', 'exhibitions', 'agenda']) scope?: string;
  @IsOptional() @IsIn(['occasion', 'exhibition']) type?: string;
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month?: string;
  /** only the events running on this day (yyyy-mm-dd), for the calendar of the public page */
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/) day?: string;
  /** free text over the name, sector, organizer and place */
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() @MaxLength(150) sector?: string;
  @IsOptional() @IsString() @MaxLength(200) organizer?: string;
  @IsOptional() @IsIn(['organized', 'participating']) participation?: string;
  @IsOptional() @Matches(/^\d{4}$/) year?: string;
}

export class LinkEventNewsDto {
  @IsArray() @ArrayMaxSize(50) @Transform(({ value }) => (Array.isArray(value) ? value.map(Number) : value)) newsIds: number[];
  /** what the attached news is: news, visit, meeting, participation, activity, coverage */
  @IsOptional() @IsIn(EVENT_NEWS_KINDS) kind?: string;
}

