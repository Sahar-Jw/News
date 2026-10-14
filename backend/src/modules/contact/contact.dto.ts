import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

const clean = () => Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : value));
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));

export class CreateContactDto {
  @clean() @IsString() @MinLength(2) @MaxLength(150) name: string;
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)) @IsEmail() @MaxLength(190) email: string;
  @clean() @IsString() @MinLength(2) @MaxLength(255) subject: string;
  @clean() @IsString() @MinLength(5) @MaxLength(5000) message: string;
}

export class MessageListQueryDto extends AdminListQueryDto {
  @IsOptional() @toBool() @IsBoolean() isRead?: boolean;
}
