import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { BulkDeleteDto } from '../news/news.dto';
import { AppointmentsQueryDto, CreateAppointmentDto, DashboardQueryDto, UpdateAppointmentDto } from './appointments.dto';
import { AppointmentsService } from './appointments.service';

const cols = (ar: boolean, label: (code: string) => string): ExportColumn[] => [
  { key: 'id', label: '#', value: (r) => r.id },
  { key: 'customerName', label: ar ? 'العميل' : 'Customer', value: (r) => r.customerName },
  { key: 'customerPhone', label: ar ? 'الهاتف' : 'Phone', value: (r) => r.customerPhone },
  { key: 'appointmentDate', label: ar ? 'التاريخ' : 'Date', value: (r) => r.appointmentDate },
  { key: 'appointmentTime', label: ar ? 'الساعة' : 'Hour', value: (r) => r.appointmentTime },
  { key: 'status', label: ar ? 'الحالة' : 'Status', value: (r) => label(r.status) },
  { key: 'procedures', label: ar ? 'الإجراءات' : 'Procedures', value: (r) => r.procedures },
];

@Controller('admin/appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  @Permissions(PERM.APPOINTMENTS_READ)
  list(@Query() q: AppointmentsQueryDto) {
    return this.service.list(q);
  }

  // the status list of Settings, for the form select, the filter and the badges
  @Get('statuses')
  @Permissions(PERM.APPOINTMENTS_READ, PERM.APPOINTMENTS_CREATE, PERM.APPOINTMENTS_UPDATE, PERM.APPOINTMENTS_DASHBOARD)
  statuses() {
    return this.service.statuses();
  }

  @Get('dashboard')
  @Permissions(PERM.APPOINTMENTS_DASHBOARD)
  dashboard(@Query() q: DashboardQueryDto) {
    return this.service.dashboard(q.today);
  }

  @Get('export')
  @Permissions(PERM.APPOINTMENTS_EXPORT)
  async export(@Query() q: AppointmentsQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response) {
    const ar = ex.lang !== 'en';
    const statuses = await this.service.statuses();
    const label = (code: string) => { const s = statuses.find((x) => x.code === code); return s ? (ar ? s.ar : s.en) : code; };
    const picked = pickColumns(cols(ar, label), ex.columns);
    return sendExport(res, ex.format, 'dates', picked, await this.service.listAll(q), ar);
  }

  @Post()
  @Permissions(PERM.APPOINTMENTS_CREATE)
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.APPOINTMENTS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.APPOINTMENTS_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAppointmentDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Delete(':id')
  @Permissions(PERM.APPOINTMENTS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove([id], u);
  }
}
