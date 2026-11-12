import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** The kinds of results of the site-wide search (news have their own search, `GET public/search`). */
export const SEARCH_GROUPS = ['events', 'documents', 'committees', 'services', 'training', 'incubator', 'get2trade', 'expo', 'board', 'faq', 'pages'] as const;

export class SiteSearchQueryDto {
  @IsString() @MinLength(2) @MaxLength(100) q: string;
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
  /** only one kind of result */
  @IsOptional() @IsIn(SEARCH_GROUPS) group?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
