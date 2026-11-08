import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { NAV_URL } from '../nav/nav.dto';
import { FOOTER_KINDS } from './footer.entity';

const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));

export class FooterLinkDto {
  @IsString() @MinLength(1) @MaxLength(150) titleAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) titleEn?: string | null;
  @IsString() @MaxLength(500) @Matches(NAV_URL, { message: 'الرابط يجب أن يكون مساراً داخل الموقع يبدأ بـ / أو رابطاً كاملاً http(s)' }) url: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() newTab?: boolean;
}

export class FooterGroupDto {
  @IsString() @MinLength(1) @MaxLength(150) titleAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) titleEn?: string | null;
  @IsIn(FOOTER_KINDS as unknown as string[]) kind: string;
  @IsInt() @Min(1) @Max(2) columns: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => FooterLinkDto) items: FooterLinkDto[];
}

/** The whole footer in its final order; saving replaces what is stored. */
export class SaveFooterDto {
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => FooterGroupDto) groups: FooterGroupDto[];
}

export class PublicFooterQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}
