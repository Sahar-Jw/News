import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { MAX_IMAGES_PER_RECORD } from '../../common/constants';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { adminPage, paged, publicPage } from '../../common/utils/pagination';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { escapeLike } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { Gallery } from './gallery.entity';
import { CreateGalleryDto, PublicGalleryQueryDto, UpdateGalleryDto } from './gallery.dto';

@Injectable()
export class GalleryService {
  constructor(
    @InjectRepository(Gallery) private readonly repo: Repository<Gallery>,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
  ) {}

  present(g: Gallery) {
    const images = g.images ?? [];
    return { id: g.id, titleAr: g.titleAr, titleEn: g.titleEn, images, imageUrls: images.map((p) => this.storage.url(p)), imageCount: images.length, createdAt: g.createdAt, updatedAt: g.updatedAt };
  }

  async list(q: AdminListQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('g');
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('g.titleAr LIKE :like', { like }).orWhere('g.titleEn LIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { titleAr: 'g.titleAr', titleEn: 'g.titleEn' });
    qb.orderBy('g.id', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  async create(dto: CreateGalleryDto, files: Express.Multer.File[], actor: AuthUser) {
    if (!files?.length) throw new BadRequestException('أضف صورة واحدة على الأقل');
    if (files.length > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const paths = await this.storage.saveImages(files, 'gallery');
    try {
      const saved = await this.repo.save(this.repo.create({ titleAr: dto.titleAr.trim(), titleEn: dto.titleEn.trim(), images: paths, createdById: actor.id }));
      await this.audit.log({ category: 'gallery', action: 'create', description: `إضافة معرض صور: ${saved.titleAr}`, actorId: actor.id, entityType: 'galleries', entityId: saved.id });
      return this.present(saved);
    } catch (e) {
      await this.storage.removeMany(paths);
      throw e;
    }
  }

  async update(id: number, dto: UpdateGalleryDto, files: Express.Multer.File[], actor: AuthUser) {
    const g = await this.repo.findOne({ where: { id } });
    if (!g) throw new NotFoundException('المعرض غير موجود');
    const existing = g.images ?? [];
    const keep = dto.keepImages ?? existing;
    if (keep.some((p) => !existing.includes(p))) throw new BadRequestException('مسار صورة غير موجود في السجل');
    if (keep.length + (files?.length ?? 0) < 1) throw new BadRequestException('يجب أن يحتوي المعرض على صورة واحدة على الأقل');
    if (keep.length + (files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const removed = existing.filter((p) => !keep.includes(p));
    const added = await this.storage.saveImages(files ?? [], 'gallery');
    try {
      g.titleAr = dto.titleAr?.trim() ?? g.titleAr;
      g.titleEn = dto.titleEn?.trim() ?? g.titleEn;
      g.images = [...keep, ...added];
      const saved = await this.repo.save(g);
      await this.storage.removeMany(removed);
      await this.audit.log({ category: 'gallery', action: 'update', description: `تعديل معرض صور: ${saved.titleAr}`, actorId: actor.id, entityType: 'galleries', entityId: id });
      return this.present(saved);
    } catch (e) {
      await this.storage.removeMany(added);
      throw e;
    }
  }

  async bulkRemove(ids: number[], actor: AuthUser) {
    const unique = [...new Set(ids)];
    const rows = await this.repo.find({ where: { id: In(unique) } });
    if (rows.length !== unique.length) throw new NotFoundException('بعض المعارض غير موجودة');
    await this.repo.delete({ id: In(unique) });
    await this.storage.removeMany(rows.flatMap((r) => r.images ?? []));
    await this.audit.log({ category: 'gallery', action: 'delete', description: `حذف ${rows.length} معرض صور`, actorId: actor.id, entityType: 'galleries', details: { ids: unique } });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public
  private card(g: Gallery, lang: string) {
    return { id: g.id, title: lang === 'en' ? g.titleEn : g.titleAr, images: (g.images ?? []).map((p) => this.storage.url(p)), createdAt: g.createdAt };
  }

  async publicList(q: PublicGalleryQueryDto) {
    const p = publicPage(q);
    const [rows, total] = await this.repo.findAndCount({ order: { id: 'DESC' }, skip: p.skip, take: p.limit });
    return paged(rows.map((r) => this.card(r, q.lang ?? 'ar')), total, p);
  }

  async publicOne(id: number, lang = 'ar') {
    const g = await this.repo.findOne({ where: { id } });
    if (!g) throw new NotFoundException('المعرض غير موجود');
    return this.card(g, lang);
  }
}
