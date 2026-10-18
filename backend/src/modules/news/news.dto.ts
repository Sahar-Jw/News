import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Language, NewsStatus, SPECIAL_CATEGORY_CODES, Visibility } from '../../common/constants';
import { AdminListQueryDto, PublicListQueryDto } from '../../common/dto/list-query.dto';

/** multipart/form-data sends everything as strings, so booleans/arrays need explicit parsing. */
const toBool = () =>
  Transform(({ value }) => (value === 'true' || value === true || value === '1' || value === 1 ? true : value === 'false' || value === false || value === '0' || value === 0 ? false : value));
const emptyToNull = () => Transform(({ value }) => (value === '' ? null : value));

function parseList(value: any): string[] | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.startsWith('[')) {
      try {
        const arr = JSON.parse(t);
        if (Array.isArray(arr)) return arr.map(String);
      } catch {
        /* fall through to comma-separated */
      }
    }
    return t.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
  }
  return value;
}
const toList = () => Transform(({ value }) => parseList(value));

export class CreateNewsDto {
  @IsString() @MinLength(1) @MaxLength(255) title: string;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(500) subject?: string | null;

  /** Special section form: pins main_category to this reserved code. */
  @IsOptional() @emptyToNull() @IsIn(SPECIAL_CATEGORY_CODES) section?: string;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(100) mainCategory?: string;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(100) subcategory?: string | null;

  @IsOptional() @toList() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(100, { each: true }) topics?: string[];
  @IsOptional() @emptyToNull() @IsString() @MaxLength(1_000_000) body?: string | null;

  @IsOptional() @emptyToNull() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number | null;
  @IsOptional() @toBool() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @emptyToNull() @IsDateString() publishAt?: string | null;
  @IsOptional() @IsIn(Object.values(NewsStatus)) status?: NewsStatus;
  /** Defaults to Arabic when omitted. */
  @IsOptional() @IsIn(Object.values(Language)) language?: Language;
  @IsOptional() @IsIn(Object.values(Visibility)) visibility?: Visibility;
}

/** All fields optional on update; language stays optional too. */
export class UpdateNewsDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) title?: string;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(500) subject?: string | null;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(100) mainCategory?: string;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(100) subcategory?: string | null;
  @IsOptional() @toList() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(100, { each: true }) topics?: string[];
  @IsOptional() @emptyToNull() @IsString() @MaxLength(1_000_000) body?: string | null;
  @IsOptional() @emptyToNull() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number | null;
  @IsOptional() @toBool() @IsBoolean() isFeatured?: boolean;
  @IsOptional() @emptyToNull() @IsDateString() publishAt?: string | null;
  @IsOptional() @IsIn(Object.values(NewsStatus)) status?: NewsStatus;
  @IsOptional() @IsIn(Object.values(Language)) language?: Language;
  @IsOptional() @IsIn(Object.values(Visibility)) visibility?: Visibility;
  /** Existing image paths to keep; anything not listed is removed (undefined = keep all). */
  @IsOptional() @toList() @IsArray() @IsString({ each: true }) keepImages?: string[];
}

export class NewsAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(Object.values(Language)) language?: Language;
  @IsOptional() @IsIn(Object.values(NewsStatus)) status?: NewsStatus;
  @IsOptional() @IsIn(Object.values(Visibility)) visibility?: Visibility;
  /** A reserved code (special section) or the word "regular" for ordinary news. */
  @IsOptional() @IsString() @MaxLength(100) section?: string;
  @IsOptional() @IsString() @MaxLength(100) mainCategory?: string;
  @IsOptional() @IsString() @MaxLength(100) subcategory?: string;
  @IsOptional() @IsString() @MaxLength(100) topic?: string;
  @IsOptional() @toBool() @IsBoolean() isFeatured?: boolean;
}

export class BulkDeleteDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @Type(() => Number) @IsInt({ each: true }) ids: number[];
}

export class PublicNewsQueryDto extends PublicListQueryDto {
  @IsOptional() @IsIn(Object.values(Language)) lang?: Language;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() @MaxLength(100) subcategory?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  /** comma-separated topics: matches news that has at least one of them */
  @IsOptional() @IsString() @MaxLength(500) topics?: string;
}

export class SearchQueryDto extends PublicNewsQueryDto {}

export class LangQueryDto {
  @IsOptional() @IsIn(Object.values(Language)) lang?: Language;
}
