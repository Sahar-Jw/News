import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { MAX_IMAGES_PER_RECORD } from '../../common/constants';
import { AdminListQueryDto } from '../../common/dto/list-query.dto';
import { AuthUser } from '../../common/types';
import { adminPage, paged, publicPage } from '../../common/utils/pagination';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { escapeLike } from '../../common/utils/text';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { parseYoutubeId, youtubeWatchUrl } from '../../common/utils/youtube';
import { GALLERY_CATEGORIES, Gallery, GalleryCategory, GalleryKind, galleryCoverPath } from './gallery.entity';
import { CreateGalleryDto, PublicGalleryQueryDto, UpdateGalleryDto } from './gallery.dto';
import { removedChanges } from '../audit/audit-snapshot';

@Injectable()
export class GalleryService {
  constructor(
    @InjectRepository(Gallery) private readonly repo: Repository<Gallery>,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
  ) {}

  present(g: Gallery) {
    const images = g.images ?? [];
    return { id: g.id, titleAr: g.titleAr, titleEn: g.titleEn ?? '', kind: g.kind, youtubeUrl: g.youtubeUrl ?? '', category: g.category ?? '', images, imageUrls: images.map((p) => this.storage.url(p)), imageCount: images.length, thumbnail: galleryCoverPath(g), committeeId: g.committeeId ? Number(g.committeeId) : null, createdAt: g.createdAt, updatedAt: g.updatedAt };
  }

  async list(q: AdminListQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('g');
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('g.titleAr ILIKE :like', { like }).orWhere('g.titleEn ILIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { titleAr: 'g.titleAr', titleEn: 'g.titleEn' });
    qb.orderBy('g.id', q.sortDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  /** one album / video for the edit window */
  async adminOne(id: number) {
    const g = await this.repo.findOne({ where: { id } });
    if (!g) throw new NotFoundException('المعرض غير موجود');
    return this.present(g);
  }

  /** The video is optional: empty = none; a given link must be a valid YouTube link (stored in its canonical form). */
  private youtubeOf(given: string | null | undefined): string | null {
    if (!given || !given.trim()) return null;
    const id = parseYoutubeId(given);
    if (!id) throw new BadRequestException('رابط يوتيوب غير صالح');
    return youtubeWatchUrl(id);
  }

  /** 'video' only when the item has a video and no pictures; anything else is 'photos' (the column is kept for older readers). */
  private kindOf(youtubeUrl: string | null, imageCount: number): GalleryKind {
    return youtubeUrl && imageCount === 0 ? 'video' : 'photos';
  }

  /** The cover as sent by the form: a kept picture's path, or "new:<n>" = the n-th file of this request. Anything else = no choice (the first picture). */
  private thumbOf(given: string | null | undefined, kept: string[], added: string[]): string | null {
    if (!given) return null;
    const m = /^new:(\d+)$/.exec(given);
    if (m) return added[Number(m[1])] ?? null;
    return kept.includes(given) ? given : null;
  }

  async create(dto: CreateGalleryDto, files: Express.Multer.File[], actor: AuthUser) {
    const youtubeUrl = this.youtubeOf(dto.youtubeUrl);
    // both parts are optional, but an item needs at least one of them
    if (!files?.length && !youtubeUrl) throw new BadRequestException('أضف صورة أو فيديو واحداً على الأقل');
    if ((files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const paths = await this.storage.saveImages(files ?? [], 'gallery');
    try {
      const saved = await this.repo.save(this.repo.create({
        titleAr: dto.titleAr.trim(), titleEn: (dto.titleEn ?? '').trim(), kind: this.kindOf(youtubeUrl, paths.length), youtubeUrl, category: (dto.category ?? null) as GalleryCategory | null,
        images: paths, thumbnail: this.thumbOf(dto.thumbnail, [], paths), committeeId: dto.committeeId ?? null, createdById: actor.id,
      }));
      await this.audit.log({ category: 'gallery', action: 'create', description: `${paths.length ? 'إضافة معرض صور' : 'إضافة فيديو'}: ${saved.titleAr}`, actorId: actor.id, entityType: 'galleries', entityId: saved.id });
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
    const youtubeUrl = this.youtubeOf(dto.youtubeUrl !== undefined ? dto.youtubeUrl : g.youtubeUrl);
    if (keep.length + (files?.length ?? 0) < 1 && !youtubeUrl) throw new BadRequestException('يجب أن يحتوي العنصر على صورة أو فيديو واحد على الأقل');
    if (keep.length + (files?.length ?? 0) > MAX_IMAGES_PER_RECORD) throw new BadRequestException('عدد الصور كبير جداً');
    const removed = existing.filter((p) => !keep.includes(p));
    const added = await this.storage.saveImages(files ?? [], 'gallery');
    try {
      g.titleAr = dto.titleAr?.trim() ?? g.titleAr;
      g.titleEn = dto.titleEn !== undefined ? dto.titleEn.trim() : g.titleEn ?? '';
      if (dto.committeeId !== undefined) g.committeeId = dto.committeeId;
      g.youtubeUrl = youtubeUrl;
      if (dto.category !== undefined) g.category = (dto.category ?? null) as GalleryCategory | null;
      g.images = [...keep, ...added];
      g.kind = this.kindOf(youtubeUrl, g.images.length);
      // cover: what the form sent; when it sent nothing the old one stays while its picture is still there
      g.thumbnail = dto.thumbnail !== undefined ? this.thumbOf(dto.thumbnail, keep, added) : g.thumbnail && keep.includes(g.thumbnail) ? g.thumbnail : null;
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
    await this.audit.log({ category: 'gallery', action: 'delete', description: `حذف ${rows.length} معرض صور`, actorId: actor.id, entityType: 'galleries', details: { ids: unique }, changes: removedChanges('galleries', rows) });
    return { deleted: rows.length };
  }

  // ---------------------------------------------------------------- public
  /** Cover picture: the chosen thumbnail, else the first uploaded picture, else (for a video) YouTube's own thumbnail. */
  private cover(g: Gallery, id: string | null) {
    const rel = galleryCoverPath(g);
    return rel ? this.storage.url(rel) : id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  }

  private card(g: Gallery, lang: string) {
    const youtubeId = parseYoutubeId(g.youtubeUrl);
    const images = (g.images ?? []).map((p) => this.storage.url(p));
    return {
      id: g.id, title: (lang === 'en' && g.titleEn) || g.titleAr, kind: g.kind, category: g.category, youtubeId, hasVideo: !!youtubeId, hasImages: images.length > 0,
      thumb: this.cover(g, youtubeId), images, createdAt: g.createdAt,
    };
  }

  /** "photos" = has at least one picture; "video" = has a video. An item with both is found under each. */
  private applyType(qb: SelectQueryBuilder<Gallery>, type?: string) {
    if (type === 'photos') qb.andWhere(`jsonb_array_length(COALESCE(g.images, CAST('[]' AS jsonb))) > 0`);
    else if (type === 'video') qb.andWhere('g.youtubeUrl IS NOT NULL');
  }

  async publicList(q: PublicGalleryQueryDto) {
    const p = publicPage(q);
    const qb = this.repo.createQueryBuilder('g').orderBy('g.id', 'DESC').skip(p.skip).take(p.limit);
    if (q.committeeId) qb.andWhere('g.committeeId = :cid', { cid: q.committeeId });
    this.applyType(qb, q.type);
    if (q.category) qb.andWhere('g.category = :cat', { cat: q.category });
    if (q.year) qb.andWhere('EXTRACT(YEAR FROM g.createdAt) = :year', { year: q.year });
    const [rows, total] = await qb.getManyAndCount();
    return paged(rows.map((r) => this.card(r, q.lang ?? 'ar')), total, p);
  }

  /** Categories that have at least one item, with their counts (the filter chips of the public page). */
  async publicCategories(type?: string) {
    const qb = this.repo.createQueryBuilder('g').select('g.category', 'category').addSelect('COUNT(*)', 'n').where('g.category IS NOT NULL').groupBy('g.category');
    this.applyType(qb, type);
    const rows = await qb.getRawMany();
    return GALLERY_CATEGORIES.filter((c) => rows.some((r) => r.category === c)).map((c) => ({ category: c, count: Number(rows.find((r) => r.category === c)!.n) }));
  }

  /** Years that have at least one item (the archive filter of the media center), newest first. */
  async publicYears(type?: string) {
    const qb = this.repo.createQueryBuilder('g').select('EXTRACT(YEAR FROM g.createdAt)', 'y').groupBy('y').orderBy('y', 'DESC');
    this.applyType(qb, type);
    const rows = await qb.getRawMany();
    return rows.map((r) => Number(r.y)).filter((y) => Number.isFinite(y));
  }

  async publicOne(id: number, lang = 'ar') {
    const g = await this.repo.findOne({ where: { id } });
    if (!g) throw new NotFoundException('المعرض غير موجود');
    return this.card(g, lang);
  }
}
