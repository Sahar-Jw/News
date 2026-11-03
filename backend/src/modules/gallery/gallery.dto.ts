import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { parseStringList } from '../../common/dto/form-transforms';
import { PublicListQueryDto } from '../../common/dto/list-query.dto';

/** multipart value: "" or missing = no committee */
const committeeId = () => Transform(({ value }) => (value === '' || value === null || value === undefined || value === 'null' ? null : Number(value)));

export class CreateGalleryDto {
  @committeeId() @IsOptional() @IsInt() committeeId?: number | null;
  @IsString() @MinLength(1) @MaxLength(255) titleAr: string;
  @IsString() @MinLength(1) @MaxLength(255) titleEn: string;
}

export class UpdateGalleryDto {
  @committeeId() @IsOptional() @IsInt() committeeId?: number | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleAr?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleEn?: string;
  @IsOptional() @Transform(parseStringList) @IsArray() @IsString({ each: true }) keepImages?: string[];
}

export class PublicGalleryQueryDto extends PublicListQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
  @IsOptional() @Type(() => Number) @IsInt() committeeId?: number;
}
