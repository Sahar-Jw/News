import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { City } from '../../entities';
import { AuditService } from '../audit/audit.service';
import { CreateCityDto, UpdateCityDto } from './cities.dto';

@Injectable()
export class CitiesService {
  constructor(
    @InjectRepository(City) private readonly repo: Repository<City>,
    private readonly audit: AuditService,
  ) {}

  all() {
    return this.repo.find({ order: { nameAr: 'ASC' } });
  }

  async list(q: AdminListQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('c');
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('c.nameAr LIKE :like', { like }).orWhere('c.nameEn LIKE :like', { like }).orWhere('c.code LIKE :like', { like })));
    }
    qb.orderBy('c.id', q.sortDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows, total, p);
  }

  async create(dto: CreateCityDto, actor: AuthUser) {
    if (await this.repo.findOne({ where: { code: dto.code } })) throw new ConflictException('رمز المدينة مستخدم مسبقاً');
    const c = await this.repo.save(this.repo.create(dto));
    await this.audit.log({ category: 'cities', action: 'create', description: `إضافة المدينة ${c.nameAr}`, actorId: actor.id, entityType: 'cities', entityId: c.id });
    return c;
  }

  async update(id: number, dto: UpdateCityDto, actor: AuthUser) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('المدينة غير موجودة');
    Object.assign(c, dto);
    await this.repo.save(c);
    await this.audit.log({ category: 'cities', action: 'update', description: `تعديل المدينة ${c.nameAr}`, actorId: actor.id, entityType: 'cities', entityId: id });
    return c;
  }

  async remove(id: number, actor: AuthUser) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('المدينة غير موجودة');
    await this.repo.delete(id); // users.city_id is ON DELETE SET NULL
    await this.audit.log({ category: 'cities', action: 'delete', description: `حذف المدينة ${c.nameAr}`, actorId: actor.id, entityType: 'cities', entityId: id });
    return { deleted: true };
  }
}
