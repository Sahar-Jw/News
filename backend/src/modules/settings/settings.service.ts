import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { AuthUser } from '../../common/types';
import { applyColumnFilters } from '../../common/utils/column-filters';
import { adminPage, paged } from '../../common/utils/pagination';
import { escapeLike } from '../../common/utils/text';
import { SiteSetting } from './site-setting.entity';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { SettingsListQueryDto } from './settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SiteSetting) private readonly repo: Repository<SiteSetting>,
    private readonly audit: AuditService,
    private readonly storage: FileStorageService,
  ) {}

  /** Typed value for API consumers. */
  typed(s: SiteSetting): any {
    const v = s.value;
    if (v === null || v === '') return s.valueType === 'boolean' ? false : null;
    switch (s.valueType) {
      case 'number':
        return Number(v);
      case 'boolean':
        return v === 'true' || v === '1';
      case 'json':
        try {
          return JSON.parse(v);
        } catch {
          return null;
        }
      case 'file':
        return v; // relative path; use fileUrl for the link
      default:
        return v;
    }
  }

  present(s: SiteSetting) {
    return {
      id: s.id,
      category: s.category,
      key: s.key,
      valueType: s.valueType,
      value: this.typed(s),
      fileUrl: s.valueType === 'file' ? this.storage.url(s.value) : undefined,
      updatedAt: s.updatedAt,
    };
  }

  /** Validates and converts an incoming value to its stored string form (SRS FR-SET-002). */
  private encode(s: SiteSetting, value: any): string | null {
    if (value === null || value === undefined || value === '') return null; // empty = unset (hidden on site)
    const bad = (m: string) => new BadRequestException(`القيمة غير صالحة للنوع ${s.valueType}: ${m}`);
    switch (s.valueType) {
      case 'text':
        if (typeof value !== 'string') throw bad('يجب أن تكون نصاً');
        if (value.length > 20000) throw bad('النص طويل جداً');
        return value;
      case 'number': {
        const n = typeof value === 'number' ? value : Number(value);
        if (typeof value === 'boolean' || !Number.isFinite(n)) throw bad('يجب أن تكون رقماً');
        return String(n);
      }
      case 'boolean':
        if (value === true || value === 'true') return 'true';
        if (value === false || value === 'false') return 'false';
        throw bad('يجب أن تكون true أو false');
      case 'url':
        try {
          const u = new URL(String(value));
          if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
          return u.toString();
        } catch {
          throw bad('رابط http/https غير صالح');
        }
      case 'color':
        if (typeof value !== 'string' || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) throw bad('لون HEX مثل #0b5ed7');
        return value;
      case 'file':
        // files are set through the upload endpoint; here only a relative path (or clearing) is accepted
        if (typeof value !== 'string' || !this.storage.resolveSafe(value) || value.startsWith('private/')) throw bad('مسار ملف نسبي غير صالح');
        return value;
      case 'json':
        try {
          const str = typeof value === 'string' ? value : JSON.stringify(value);
          JSON.parse(str);
          if (str.length > 200000) throw new Error();
          return str;
        } catch {
          throw bad('JSON غير صالح');
        }
    }
  }

  private async getOrFail(id: number) {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('الإعداد غير موجود');
    return s;
  }

  async list(q: SettingsListQueryDto) {
    const p = adminPage(q);
    const qb = this.repo.createQueryBuilder('s');
    if (q.category) qb.andWhere('s.category = :c', { c: q.category });
    if (q.q) {
      const like = `%${escapeLike(q.q)}%`;
      qb.andWhere(new Brackets((b) => b.where('s.key LIKE :like', { like }).orWhere('s.value LIKE :like', { like })));
    }
    applyColumnFilters(qb, q.cf, { category: 's.category', key: 's.key', valueType: 's.valueType', value: 's.value' });
    qb.orderBy('s.category', 'ASC').addOrderBy('s.id', 'ASC');
    const [rows, total] = await qb.skip(p.skip).take(p.limit).getManyAndCount();
    return paged(rows.map((r) => this.present(r)), total, p);
  }

  async categories() {
    const rows = await this.repo.createQueryBuilder('s').select('s.category', 'category').addSelect('COUNT(*)', 'count').groupBy('s.category').orderBy('s.category').getRawMany();
    return rows.map((r) => ({ category: r.category, count: Number(r.count) }));
  }

  async update(id: number, value: any, actor: AuthUser) {
    const s = await this.getOrFail(id);
    const old = s.value;
    s.value = this.encode(s, value);
    await this.repo.save(s);
    if (s.valueType === 'file' && old && old !== s.value) await this.storage.remove(old);
    await this.audit.log({ category: 'settings', action: 'update', description: `تعديل الإعداد ${s.category}.${s.key}`, actorId: actor.id, entityType: 'site_settings', entityId: id, details: { key: `${s.category}.${s.key}` } });
    return this.present(s);
  }

  async uploadFile(id: number, file: Express.Multer.File, actor: AuthUser) {
    const s = await this.getOrFail(id);
    if (s.valueType !== 'file') throw new BadRequestException('هذا الإعداد ليس من نوع ملف');
    if (!file) throw new BadRequestException('لم يتم إرسال ملف');
    const rel = s.key === 'favicon' ? await this.storage.saveFavicon(file, 'site') : await this.storage.saveImage(file, 'site');
    const old = s.value;
    try {
      s.value = rel;
      await this.repo.save(s);
    } catch (e) {
      await this.storage.remove(rel);
      throw e;
    }
    await this.storage.remove(old);
    await this.audit.log({ category: 'settings', action: 'update.file', description: `تحديث ملف الإعداد ${s.category}.${s.key}`, actorId: actor.id, entityType: 'site_settings', entityId: id });
    return this.present(s);
  }

  /** { category: { key: typedValue } } – used by the public home endpoint. */
  async publicMap() {
    const rows = await this.repo.find();
    const out: Record<string, Record<string, any>> = {};
    for (const r of rows) {
      (out[r.category] ??= {})[r.key] = this.typed(r);
      if (r.valueType === 'file') out[r.category][`${r.key}_url`] = this.storage.url(r.value);
    }
    return out;
  }
}
