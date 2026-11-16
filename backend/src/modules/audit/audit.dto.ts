import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

export class AuditListQueryDto extends AdminListQueryDto {
  @IsOptional() @IsString() @MaxLength(50) category?: string;
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  /** the kind of action the screen filters by (create, update, delete, login, logout, failed, password, export, download, access, other) */
  @IsOptional() @IsIn(['create', 'update', 'delete', 'login', 'logout', 'failed', 'password', 'export', 'download', 'access', 'other']) kind?: string;
  @IsOptional() @Type(() => Number) @IsInt() actorId?: number;
  /** the table / record type the action touched (news, users ...) */
  @IsOptional() @IsString() @MaxLength(50) entityType?: string;
  /** success = normal actions, failure = refused or failed attempts (wrong password, permission denied ...), warning = needs a look */
  @IsOptional() @IsIn(['success', 'failure', 'warning']) outcome?: string;
}
