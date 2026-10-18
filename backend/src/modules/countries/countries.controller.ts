import { Body, Controller, Get, Post } from '@nestjs/common';
import { PERM } from '../../common/constants';
import { CurrentUser, Permissions, Public } from '../../common/decorators';
import { AuthUser } from '../../common/types';
import { CreateCountryDto } from './countries.dto';
import { CountriesService } from './countries.service';

@Controller()
export class CountriesController {
  constructor(private readonly service: CountriesService) {}

  /** Used by the profile form. */
  @Public()
  @Get('public/countries')
  publicList() {
    return this.service.all();
  }

  @Post('admin/countries')
  @Permissions(PERM.COUNTRIES_CREATE)
  create(@Body() dto: CreateCountryDto, @CurrentUser() u: AuthUser) {
    return this.service.create(dto, u);
  }
}
