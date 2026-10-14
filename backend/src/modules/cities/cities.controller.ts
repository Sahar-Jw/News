import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { CreateCityDto, UpdateCityDto } from './cities.dto';
import { CitiesService } from './cities.service';

@Controller()
export class CitiesController {
  constructor(private readonly service: CitiesService) {}

  /** Used by the registration / profile forms. */
  @Public()
  @Get('public/cities')
  publicList() {
    return this.service.all();
  }

  @Get('admin/cities')
  @Permissions(PERM.CITIES_MANAGE)
  list(@Query() q: AdminListQueryDto) {
    return this.service.list(q);
  }

  @Post('admin/cities')
  @Permissions(PERM.CITIES_MANAGE)
  create(@Body() dto: CreateCityDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }

  @Patch('admin/cities/:id')
  @Permissions(PERM.CITIES_MANAGE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCityDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Delete('admin/cities/:id')
  @Permissions(PERM.CITIES_MANAGE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.remove(id, u);
  }
}
