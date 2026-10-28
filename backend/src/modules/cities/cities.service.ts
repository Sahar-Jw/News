import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { City } from './city.entity';
import { AuditService } from '../audit/audit.service';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { CreateCityDto, UpdateCityDto } from './cities.dto';
import { removedChanges } from '../audit/audit-snapshot';

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
      qb.andWhere(new Brackets((b) => b.where('c.nameAr ILIKE :like', { like }).orWhere('c.nameEn ILIKE :like', { like }).orWhere('c.code ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { code: 'c.code', nameAr: 'c.nameAr', nameEn: 'c.nameEn' });
    qb.orderBy('c.id', q.sortDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows, total, p);
  }

  async create(dto: CreateCityDto, actor: AuthUser) {
    if (dto.code && (await this.repo.findOne({ where: { code: dto.code } }))) throw new ConflictException('رمز المدينة مستخدم مسبقاً');
    const dup = await this.repo
      .createQueryBuilder('c')
      .where('LOWER(c.nameEn) = LOWER(:en) OR c.nameAr = :ar', { en: dto.nameEn.trim(), ar: dto.nameAr.trim() })
      .getOne();
    if (dup) throw new ConflictException('المدينة موجودة مسبقاً');
    const code = dto.code ?? (await this.freeCode(dto.nameEn));
    const c = await this.repo.save(this.repo.create({ ...dto, code }));
    await this.audit.log({ category: 'cities', action: 'create', description: `إضافة المدينة ${c.nameAr}`, actorId: actor.id, entityType: 'cities', entityId: c.id });
    return c;
  }

  private async freeCode(nameEn: string) {
    let base = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 44);
    if (base.length < 2) base = 'city';
    let code = base;
    for (let i = 2; await this.repo.findOne({ where: { code } }); i++) code = `${base}-${i}`;
    return code;
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
    await this.audit.log({ category: 'cities', action: 'delete', description: `حذف المدينة ${c.nameAr}`, actorId: actor.id, entityType: 'cities', entityId: id, changes: removedChanges('cities', [c]) });
    return { deleted: true };
  }
}
