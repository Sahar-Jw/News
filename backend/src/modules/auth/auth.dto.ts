import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const lower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class RegisterDto {
  @trim() @IsString() @MinLength(2) @MaxLength(150) fullName: string;
  @lower() @IsEmail() @MaxLength(190) email: string;
  // bcrypt only uses the first 72 bytes
  @IsString() @MinLength(8, { message: 'كلمة المرور 8 أحرف على الأقل' }) @MaxLength(72) password: string;
  @IsOptional() @trim() @Matches(/^[0-9+()\-\s]{5,30}$/, { message: 'رقم هاتف غير صالح' }) phone?: string;
}

export class LoginDto {
  @lower() @IsEmail() @MaxLength(190) email: string;
  @IsString() @MinLength(1) @MaxLength(72) password: string;
}
