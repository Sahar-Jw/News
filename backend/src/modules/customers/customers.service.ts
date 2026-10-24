import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { adminPage, paged } from '../../common/utils/pagination';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { escapeLike } from '../../common/utils/text';
import { Appointment } from '../appointments/appointment.entity';
import { AuditService } from '../audit/audit.service';
import { Customer } from './customer.entity';
import { CreateCustomerDto, CustomersQueryDto, UpdateCustomerDto } from './customers.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly repo: Repository<Customer>,
    @InjectRepository(Appointment) private readonly dates: Repository<Appointment>,
    private readonly audit: AuditService,
  ) {}

  private build(q: CustomersQueryDto) {
    const qb = this.repo.createQueryBuilder('c');
    if (q.gender) qb.andWhere('c.gender = :g', { g: q.gender });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('c.name LIKE :like', { like }).orWhere('c.phone LIKE :like', { like }).orWhere('c.procedures LIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { id: 'CAST(c.id AS CHAR)', name: 'c.name', phone: 'c.phone', age: 'CAST(c.age AS CHAR)', procedures: 'c.procedures' });
    qb.orderBy('c.id', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC');
    return qb;
  }

  async list(q: CustomersQueryDto) {
    const p = adminPage(q);
    const [rows, total] = await this.build(q).skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows, total, p);
  }

  listAll(q: CustomersQueryDto) {
    return this.build(q).take(10000).getMany();
  }

  /** Light list for the customer select of the Dates form. */
  options() {
    return this.repo.find({ select: { id: true, name: true, phone: true }, order: { name: 'ASC' }, take: 5000 });
  }

  async create(dto: CreateCustomerDto, actor: AuthUser) {
    const c = await this.repo.save(
      this.repo.create({ name: dto.name, phone: dto.phone, age: dto.age ?? null, gender: dto.gender ?? null, procedures: dto.procedures?.trim() || null, createdById: actor.id }),
    );
    await this.audit.log({ category: 'customers', action: 'create', description: 'إضافة عميل', actorId: actor.id, entityType: 'customers', entityId: c.id });
    return c;
  }

  async update(id: number, dto: UpdateCustomerDto, actor: AuthUser) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('العميل غير موجود');
    if (dto.name !== undefined) c.name = dto.name;
    if (dto.phone !== undefined) c.phone = dto.phone;
    if (dto.age !== undefined) c.age = dto.age;
    if (dto.gender !== undefined) c.gender = dto.gender;
    if (dto.procedures !== undefined) c.procedures = dto.procedures?.trim() || null;
    const saved = await this.repo.save(c);
    await this.audit.log({ category: 'customers', action: 'update', description: 'تعديل عميل', actorId: actor.id, entityType: 'customers', entityId: id });
    return saved;
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) }, select: { id: true } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض العملاء غير موجودين');
    if (await this.dates.count({ where: { customerId: In(unique) } })) throw new ConflictException('لا يمكن حذف عميل لديه مواعيد، احذف مواعيده أولاً');
    await this.repo.delete({ id: In(unique) });
    await this.audit.log({ category: 'customers', action: 'delete', description: `حذف ${rows.length} عميل`, actorId: actor.id, entityType: 'customers', details: { ids: unique } });
    return { deleted: rows.length };
  }
}
