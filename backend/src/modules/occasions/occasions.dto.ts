import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { parseStringList } from '../../common/dto/form-transforms';
import { AdminListQueryDto, PublicListQueryDto } from '../../common/dto/list-query.dto';

export class CreateOccasionDto {
  @IsString() @MinLength(1) @MaxLength(255) titleAr: string;
  @IsString() @MinLength(1) @MaxLength(255) titleEn: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'التاريخ يجب أن يكون بصيغة YYYY-MM-DD' }) eventDate: string;
}

export class UpdateOccasionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleAr?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleEn?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'التاريخ يجب أن يكون بصيغة YYYY-MM-DD' }) eventDate?: string;
  /** saved images to keep (JSON string in multipart); omitted = keep all */
  @IsOptional() @Transform(parseStringList) @IsArray() @IsString({ each: true }) keepImages?: string[];
}

export class OccasionsAdminQueryDto extends AdminListQueryDto {
  /** optional filter of the occasions table: only upcoming (date today or later) or only previous */
  @IsOptional() @IsIn(['upcoming', 'previous']) status?: string;
}

export class PublicOccasionsQueryDto extends PublicListQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
  @IsOptional() @IsIn(['upcoming', 'previous']) scope?: string;
}
