import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PERM } from '../../common/constants';
import { Permissions } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { AuditListQueryDto } from './audit.dto';
import { AuditService } from './audit.service';

const cols = (ar: boolean): ExportColumn[] => [
  { key: 'id', label: '#', value: (r) => r.id },
  { key: 'createdAt', label: ar ? 'التاريخ' : 'Date', value: (r) => r.createdAt },
  { key: 'category', label: ar ? 'الفئة' : 'Category', value: (r) => r.category },
  { key: 'action', label: ar ? 'الإجراء' : 'Action', value: (r) => r.action },
  { key: 'description', label: ar ? 'الوصف' : 'Description', value: (r) => r.description },
  { key: 'actor', label: ar ? 'المنفّذ' : 'Actor', value: (r) => r.actor?.fullName ?? '' },
];

/** Read-only: there is intentionally no create/update/delete route (SRS FR-LOG-002). */
@Controller('admin/audit-logs')
@Permissions(PERM.AUDIT_READ)
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  list(@Query() q: AuditListQueryDto) {
    return this.service.list(q);
  }

  @Get('export')
  @Permissions(PERM.AUDIT_EXPORT)
  async export(@Query() q: AuditListQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response) {
    const ar = ex.lang !== 'en';
    const columns = pickColumns(cols(ar), ex.columns);
    return sendExport(res, ex.format, 'audit-logs', columns, await this.service.listAll(q), ar);
  }
}
