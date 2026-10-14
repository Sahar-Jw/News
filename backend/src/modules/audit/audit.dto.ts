import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

export class AuditListQueryDto extends AdminListQueryDto {
  @IsOptional() @IsString() @MaxLength(50) category?: string;
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  @IsOptional() @Type(() => Number) @IsInt() actorId?: number;
}
