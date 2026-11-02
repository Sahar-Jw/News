import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { FAQ_SCOPES } from './faq.entity';

const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));

export class CreateFaqDto {
  @IsOptional() @IsIn(FAQ_SCOPES as unknown as string[]) scope?: string;
  @IsString() @MinLength(1) @MaxLength(500) questionAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(500) questionEn?: string | null;
  @IsString() @MinLength(1) @MaxLength(5000) answerAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) answerEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateFaqDto {
  @IsOptional() @IsIn(FAQ_SCOPES as unknown as string[]) scope?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(500) questionAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(500) questionEn?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(5000) answerAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) answerEn?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class FaqsAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(FAQ_SCOPES as unknown as string[]) scope?: string;
}

export class PublicFaqsQueryDto {
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
  @IsOptional() @IsIn(FAQ_SCOPES as unknown as string[]) scope?: string;
}
