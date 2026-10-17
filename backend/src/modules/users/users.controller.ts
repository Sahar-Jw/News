import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { MAX_DOC_BYTES, MAX_IMAGE_BYTES, PERM } from '../../common/constants';
import { CurrentUser, Permissions } from '../../common/decorators';
import { ExportQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { ExportColumn, pickColumns, sendExport } from '../../common/utils/export';
import { ActivateUserDto, BulkIdsDto, ChangePasswordDto, UpdateProfileDto, UpdateUserDto, UserListQueryDto } from './users.dto';
import { UsersService } from './users.service';

const userCols = (ar: boolean): ExportColumn[] => [
  { key: 'id', label: '#', value: (r) => r.id },
  { key: 'fullName', label: ar ? 'الاسم' : 'Name', value: (r) => r.fullName },
  { key: 'email', label: ar ? 'البريد' : 'Email', value: (r) => r.email },
  { key: 'role', label: ar ? 'الدور' : 'Role', value: (r) => (ar ? r.role?.nameAr : r.role?.nameEn) },
  { key: 'phone', label: ar ? 'الهاتف' : 'Phone', value: (r) => r.phone },
  { key: 'isActive', label: ar ? 'مفعّل' : 'Active', value: (r) => (r.isActive ? (ar ? 'نعم' : 'Yes') : ar ? 'لا' : 'No') },
  { key: 'createdAt', label: ar ? 'تاريخ الإنشاء' : 'Created', value: (r) => r.createdAt },
];

@Controller('admin/users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @Permissions(PERM.USERS_READ)
  list(@Query() q: UserListQueryDto) {
    return this.service.list(q);
  }

  @Get('export')
  @Permissions(PERM.USERS_EXPORT)
  async export(@Query() q: UserListQueryDto, @Query() ex: ExportQueryDto, @Res() res: Response) {
    const ar = ex.lang !== 'en';
    const columns = pickColumns(userCols(ar), ex.columns);
    return sendExport(res, ex.format, 'users', columns, await this.service.listAll(q), ar);
  }

  @Post('bulk-delete')
  @HttpCode(200)
  @Permissions(PERM.USERS_DELETE)
  bulkDelete(@Body() dto: BulkIdsDto, @CurrentUser() u: AuthUser) {
    return this.service.removeMany(dto.ids, u);
  }

  @Get(':id')
  @Permissions(PERM.USERS_READ)
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @Patch(':id')
  @Permissions(PERM.USERS_UPDATE)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @CurrentUser() u: AuthUser) {
    return this.service.update(id, dto, u);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @Permissions(PERM.USERS_ACTIVATE)
  activate(@Param('id', ParseIntPipe) id: number, @Body() dto: ActivateUserDto, @CurrentUser() u: AuthUser) {
    return this.service.setActive(id, dto.active ?? true, u);
  }

  @Delete(':id')
  @Permissions(PERM.USERS_DELETE)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.service.removeMany([id], u);
  }
}

/** Any authenticated user (no permission code needed): manages only their own profile. */
@Controller('profile')
export class ProfileController {
  constructor(private readonly service: UsersService) {}

  @Get()
  get(@CurrentUser() u: AuthUser) {
    return this.service.getProfile(u.id);
  }

  @Patch()
  update(@Body() dto: UpdateProfileDto, @CurrentUser() u: AuthUser) {
    return this.service.updateProfile(u.id, dto);
  }

  @Post('password')
  @HttpCode(200)
  password(@Body() dto: ChangePasswordDto, @CurrentUser() u: AuthUser) {
    return this.service.changePassword(u.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }))
  avatar(@UploadedFile() file: Express.Multer.File, @CurrentUser() u: AuthUser) {
    return this.service.setAvatar(u.id, file);
  }

  @Post('cv')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_DOC_BYTES, files: 1 } }))
  cv(@UploadedFile() file: Express.Multer.File, @CurrentUser() u: AuthUser) {
    return this.service.setCv(u.id, file);
  }
}
