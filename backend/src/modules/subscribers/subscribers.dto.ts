import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));

export class SubscribeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() @MaxLength(190) email: string;
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}

export class TokenDto {
  @IsString() @Matches(/^[a-f0-9]{48}$/, { message: 'الرابط غير صالح' }) token: string;
}

export class SubscribersQueryDto extends AdminListQueryDto {
  @IsOptional() @toBool() @IsBoolean() isVerified?: boolean;
  @IsOptional() @toBool() @IsBoolean() isActive?: boolean;
}

export class SetActiveDto {
  @IsBoolean() isActive: boolean;
}
