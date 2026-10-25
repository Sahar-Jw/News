import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const emptyToNull = () => Transform(({ value }) => (value === '' || value === undefined ? null : value));
const toInt = () => Transform(({ value }) => (value === '' || value === null || value === undefined ? null : Number(value)));

export class CreateCustomerDto {
  @trim() @IsString() @MinLength(1) @MaxLength(150) name: string;
  @trim() @Matches(/^[0-9+()\-\s]{5,30}$/, { message: 'رقم هاتف غير صالح' }) phone: string;
  // age and gender are required; only `procedures` is optional
  @toInt() @IsInt({ message: 'العمر مطلوب' }) @Min(0) @Max(130) age: number;
  @IsIn(['male', 'female'], { message: 'الجنس مطلوب' }) gender: string;
  @IsOptional() @emptyToNull() @IsString() @MaxLength(5000) procedures?: string | null;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CustomersQueryDto extends AdminListQueryDto {
  @IsOptional() @IsIn(['male', 'female']) gender?: string;
}
