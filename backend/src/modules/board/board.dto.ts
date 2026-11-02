import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { BOARD_POSITIONS } from './board-member.entity';

// multipart/form-data: every value is a string
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));
const POS = BOARD_POSITIONS as unknown as string[];

export class CreateBoardMemberDto {
  @IsIn(POS) position: string;
  @IsString() @MinLength(1) @MaxLength(255) nameAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) jobTitleAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) jobTitleEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) bioAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) bioEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) dutiesAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) dutiesEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100) termLabel?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateBoardMemberDto {
  @IsOptional() @IsIn(POS) position?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) nameAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) nameEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) jobTitleAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) jobTitleEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) bioAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) bioEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) dutiesAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100000) dutiesEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(100) termLabel?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
  /** true = delete the current picture (ignored when a new one is uploaded) */
  @toBool() @IsOptional() @IsBoolean() removePhoto?: boolean;
}

export class BoardAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(POS) position?: string;
}
