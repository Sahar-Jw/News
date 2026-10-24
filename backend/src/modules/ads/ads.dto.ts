import { Transform } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, Matches, MaxLength, MinLength } from 'class-validator';
import { AD_PLACEMENTS } from '../../common/constants';
import { parseStringList } from '../../common/dto/form-transforms';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const URL_OPTS = { protocols: ['http', 'https'], require_protocol: true, require_tld: false };
const DATE = { message: 'التاريخ يجب أن يكون بصيغة YYYY-MM-DD' };

export class CreateAdDto {
  @trim() @IsString() @MinLength(1) @MaxLength(255) ownerCompany: string;
  @trim() @IsUrl(URL_OPTS, { message: 'الرابط يجب أن يبدأ بـ http:// أو https://' }) @MaxLength(500) linkUrl: string;
  @IsIn(AD_PLACEMENTS as unknown as string[]) placement: string;
  @IsOptional() @toBool() @IsBoolean() isActive?: boolean;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, DATE) startDate: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/, DATE) endDate: string;
}

export class UpdateAdDto {
  @IsOptional() @trim() @IsString() @MinLength(1) @MaxLength(255) ownerCompany?: string;
  @IsOptional() @trim() @IsUrl(URL_OPTS, { message: 'الرابط يجب أن يبدأ بـ http:// أو https://' }) @MaxLength(500) linkUrl?: string;
  @IsOptional() @IsIn(AD_PLACEMENTS as unknown as string[]) placement?: string;
  @IsOptional() @toBool() @IsBoolean() isActive?: boolean;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, DATE) startDate?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, DATE) endDate?: string;
  @IsOptional() @Transform(parseStringList) @IsArray() @IsString({ each: true }) keepImages?: string[];
}

export class AdsAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(AD_PLACEMENTS as unknown as string[]) placement?: string;
  @IsOptional() @toBool() @IsBoolean() isActive?: boolean;
}

export class PublicAdsQueryDto {
  @IsOptional() @IsIn(AD_PLACEMENTS as unknown as string[]) placement?: string;
}
