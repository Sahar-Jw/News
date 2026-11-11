import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

export class SettingsListQueryDto extends AdminListQueryDto {
  @Transform(({ value }) => (value === '' ? undefined : value)) @IsOptional() @IsString() @MaxLength(50) category?: string;
}

export class UpdateSettingDto {
  /** string | number | boolean | object | null – validated against the setting's value_type */
  @IsOptional() value?: any;
}

export class SaveShortcutsDto {
  /** url of the page chosen for each slot, in order; null or '' leaves the slot empty */
  @IsArray() @ArrayMaxSize(6) urls: (string | null)[];
}

export class HeroButtonDto {
  /** the page the slide's button opens (one of the site's pages), '' / null = the slide has no button */
  @IsOptional() @IsString() @MaxLength(300) url?: string | null;
  @IsOptional() @IsString() @MaxLength(40) textAr?: string | null;
  @IsOptional() @IsString() @MaxLength(40) textEn?: string | null;
}

export class SaveHeroButtonsDto {
  /** one entry per slide, in order (slide 1 first) */
  @IsArray() @ArrayMaxSize(5) @ValidateNested({ each: true }) @Type(() => HeroButtonDto) items: HeroButtonDto[];
}
