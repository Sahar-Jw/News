import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Shared query shape for every admin table (SRS TBL-FR). */
export class AdminListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @IsIn(['10', '20', '50', '100', 'all']) limit?: string;
  /** per-column search: JSON object {columnKey: text} */
  @IsOptional() @IsString() @MaxLength(2000) cf?: string;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsIn(['asc', 'desc', 'ASC', 'DESC']) sortDir?: string;
}

export class PublicListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class ExportQueryDto {
  @IsOptional() @IsIn(['csv', 'xlsx']) format?: string;
  @IsOptional() @IsString() @MaxLength(500) columns?: string;
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}

export function dayStart(s: string): Date {
  const d = new Date(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) d.setUTCHours(0, 0, 0, 0);
  return d;
}
export function dayEnd(s: string): Date {
  const d = new Date(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) d.setUTCHours(23, 59, 59, 999);
  return d;
}
