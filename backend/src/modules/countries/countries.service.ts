import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { Country } from './country.entity';
import { CreateCountryDto } from './countries.dto';

@Injectable()
export class CountriesService {
  constructor(
    @InjectRepository(Country) private readonly repo: Repository<Country>,
    private readonly audit: AuditService,
  ) {}

  all() {
    return this.repo.find({ order: { nameAr: 'ASC' } });
  }

  async create(dto: CreateCountryDto, actor: AuthUser) {
    const dup = await this.repo
      .createQueryBuilder('c')
      .where('LOWER(c.nameEn) = LOWER(:en) OR c.nameAr = :ar', { en: dto.nameEn, ar: dto.nameAr })
      .getOne();
    if (dup) throw new ConflictException('الدولة موجودة مسبقاً');
    const code = dto.code ?? (await this.freeCode(dto.nameEn));
    if (dto.code && (await this.repo.findOne({ where: { code } }))) throw new ConflictException('رمز الدولة مستخدم مسبقاً');
    const c = await this.repo.save(this.repo.create({ code, nameAr: dto.nameAr, nameEn: dto.nameEn }));
    await this.audit.log({ category: 'cities', action: 'create', description: `إضافة الدولة ${c.nameAr}`, actorId: actor.id, entityType: 'countries', entityId: c.id });
    return c;
  }

  private async freeCode(nameEn: string) {
    let base = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 44);
    if (base.length < 2) base = 'country';
    let code = base;
    for (let i = 2; await this.repo.findOne({ where: { code } }); i++) code = `${base}-${i}`;
    return code;
  }
}
