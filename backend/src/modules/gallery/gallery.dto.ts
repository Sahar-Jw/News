import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { parseStringList } from '../../common/dto/form-transforms';
import { PublicListQueryDto } from '../../common/dto/list-query.dto';

export class CreateGalleryDto {
  @IsString() @MinLength(1) @MaxLength(255) titleAr: string;
  @IsString() @MinLength(1) @MaxLength(255) titleEn: string;
}

export class UpdateGalleryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleAr?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleEn?: string;
  @IsOptional() @Transform(parseStringList) @IsArray() @IsString({ each: true }) keepImages?: string[];
}

export class PublicGalleryQueryDto extends PublicListQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}
