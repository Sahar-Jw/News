import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { parseStringList } from '../../common/dto/form-transforms';
import { PublicListQueryDto } from '../../common/dto/list-query.dto';
import { GALLERY_CATEGORIES, GALLERY_KINDS } from './gallery.entity';

/** multipart value: "" or missing = no committee */
const committeeId = () => Transform(({ value }) => (value === '' || value === null || value === undefined || value === 'null' ? null : Number(value)));

/** multipart value: "" = none */
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
const KINDS = GALLERY_KINDS as unknown as string[];
const CATS = GALLERY_CATEGORIES as unknown as string[];

export class CreateGalleryDto {
  @IsOptional() @IsIn(KINDS) kind?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) youtubeUrl?: string | null;
  @blankToNull() @IsOptional() @IsIn(CATS) category?: string | null;
  @committeeId() @IsOptional() @IsInt() committeeId?: number | null;
  @IsString() @MinLength(1) @MaxLength(255) titleAr: string;
  @IsString() @MinLength(1) @MaxLength(255) titleEn: string;
}

export class UpdateGalleryDto {
  @IsOptional() @IsIn(KINDS) kind?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) youtubeUrl?: string | null;
  @blankToNull() @IsOptional() @IsIn(CATS) category?: string | null;
  @committeeId() @IsOptional() @IsInt() committeeId?: number | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleAr?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleEn?: string;
  @IsOptional() @Transform(parseStringList) @IsArray() @IsString({ each: true }) keepImages?: string[];
}

export class PublicGalleryQueryDto extends PublicListQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
  @IsOptional() @Type(() => Number) @IsInt() committeeId?: number;
  /** photos | video */
  @IsOptional() @IsIn(KINDS) type?: string;
  @IsOptional() @IsIn(CATS) category?: string;
  /** archive year (the year the album / video was added) */
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
}
