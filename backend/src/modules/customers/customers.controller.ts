import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { BulkDeleteDto } from '../news/news.dto';
import { CreateCustomerDto, CustomersQueryDto, UpdateCustomerDto } from './customers.dto';
import { CustomersService } from './customers.service';

const gender = (ar: boolean, g: string | null) => (g === 'male' ? (ar ? 'ذكر' : 'Male') : g === 'female' ? (ar ? 'أنثى' : 'Female') : '');
const cols = (ar: boolean): ExportColumn[] => [
  { key: 'id', label: '#', value: (r) => r.id },
  { key: 'name', label: ar ? 'الاسم' : 'Name', value: (r) => r.name },
  { key: 'phone', label: ar ? 'رقم الهاتف' : 'Phone', value: (r) => r.phone },
  { key: 'age', label: ar ? 'العمر' : 'Age', value: (r) => r.age },
  { key: 'gender', label: ar ? 'الجنس' : 'Gender', value: (r) => gender(ar, r.gender) },
  { key: 'procedures', label: ar ? 'الإجراءات' : 'Procedures', value: (r) => r.procedures },
];

@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @Permissions(PERM.CUSTOMERS_READ)
  list(@Query() q: CustomersQueryDto) {
    return this.service.list(q);
  }

  @Get('export')
  @Permissions(PERM.CUSTOMERS_EXPORT)
  async export(@Query() q: CustomersQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response) {
    const ar = ex.lang !== 'en';
    const picked = pickColumns(cols(ar), ex.columns);
    return sendExport(res, ex.format, 'customers', picked, await this.service.listAll(q), ar);
  }

  // feeds the customer select of the Dates form, so whoever manages dates does not need to read the customers table
  @Get('options')
  @Permissions(PERM.CUSTOMERS_READ, PERM.APPOINTMENTS_CREATE, PERM.APPOINTMENTS_UPDATE)
  options() {
    return this.service.options();
  }

  @Post()
  @Permissions(PERM.CUSTOMERS_CREATE)
  create(@Body() dto: CreateCustomerDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }

  @Post('bulk-delete')
  @Permissions(PERM.CUSTOMERS_DELETE)
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove(dto.ids, u);
  }

  @Patch(':id')
  @Permissions(PERM.CUSTOMERS_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Delete(':id')
  @Permissions(PERM.CUSTOMERS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.bulkRemove([id], u);
  }
}
