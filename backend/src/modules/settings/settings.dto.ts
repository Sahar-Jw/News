import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

export class SettingsListQueryDto extends AdminListQueryDto {
  @IsOptional() @IsString() @MaxLength(50) category?: string;
}

export class UpdateSettingDto {
  /** string | number | boolean | object | null – validated against the setting's value_type */
  @IsOptional() value?: any;
}
