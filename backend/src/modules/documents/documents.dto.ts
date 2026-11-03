import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { DOCUMENT_KINDS } from './document.entity';

// these DTOs arrive as multipart/form-data, so every value is a string
const blankToNull = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
const toBool = () => Transform(({ value }) => (value === 'true' || value === true || value === '1' ? true : value === 'false' || value === false || value === '0' ? false : value));

export class CreateDocumentDto {
  @IsIn(DOCUMENT_KINDS as unknown as string[]) kind: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(50) docNumber?: string | null;
  @IsString() @MinLength(1) @MaxLength(255) titleAr: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) summaryAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) summaryEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) issuerAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) issuerEn?: string | null;
  @blankToNull() @IsOptional() @IsDateString() docDate?: string | null;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateDocumentDto {
  @IsOptional() @IsIn(DOCUMENT_KINDS as unknown as string[]) kind?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(50) docNumber?: string | null;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) titleAr?: string;
  @blankToNull() @IsOptional() @IsString() @MaxLength(255) titleEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) summaryAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(5000) summaryEn?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) issuerAr?: string | null;
  @blankToNull() @IsOptional() @IsString() @MaxLength(150) issuerEn?: string | null;
  @blankToNull() @IsOptional() @IsDateString() docDate?: string | null;
  @toBool() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class DocumentsAdminQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(DOCUMENT_KINDS as unknown as string[]) kind?: string;
}

export class PublicDocumentsQueryDto {
  @IsOptional() @IsIn(DOCUMENT_KINDS as unknown as string[]) kind?: string;
  /** "official" = only decisions, circulars, laws and guides (when no kind is chosen); omitted = every kind (the Library) */
  @IsOptional() @IsIn(['official']) scope?: string;
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  /** issuer as shown on the page (matches the Arabic or English issuer text exactly) */
  @IsOptional() @IsString() @MaxLength(150) issuer?: string;
  /** document date range, YYYY-MM-DD */
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
  @IsOptional() @IsIn(['ar', 'en']) lang?: string;
}
