import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
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
