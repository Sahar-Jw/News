import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MAX_DOC_BYTES, MAX_IMAGE_BYTES, MAX_PDF_BYTES } from '../../common/constants';

type Detected = { mime: string; ext: string };

let sharp: any = null;
try {
  // optional dependency – the app works without it (images stored as uploaded)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sharp = require('sharp');
} catch {
  sharp = null;
}

export const PUBLIC_FOLDERS = ['news', 'users', 'site', 'team', 'documents', 'occasions', 'gallery', 'ads'] as const;
export const PRIVATE_PREFIX = 'private/';

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.get<string>('STORAGE_DIR') || './storage');
  }

  async onModuleInit() {
    for (const f of [...PUBLIC_FOLDERS, 'private/cv', 'tmp']) await fs.mkdir(path.join(this.root, f), { recursive: true });
    if (!sharp) this.logger.warn('"sharp" is not installed: images will be validated but NOT resized/compressed.');
  }

  // ---------- type detection (by content, never by extension) ----------
  detectImage(b: Buffer): Detected | null {
    if (b.length < 12) return null;
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
    if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
    const head = b.subarray(0, 6).toString('latin1');
    if (head === 'GIF87a' || head === 'GIF89a') return { mime: 'image/gif', ext: 'gif' };
    if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
    return null;
  }

  /** Windows .ico (00 00 01 00 + image count) – only accepted for the site favicon. */
  detectIco(b: Buffer): Detected | null {
    if (b.length < 22) return null;
    if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00 && b.readUInt16LE(4) > 0) return { mime: 'image/x-icon', ext: 'ico' };
    return null;
  }

  detectDocument(b: Buffer, originalName: string): Detected | null {
    if (b.length < 8) return null;
    if (b.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
    const lower = (originalName || '').toLowerCase();
    if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && lower.endsWith('.docx')) {
      return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
    }
    if (b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) && lower.endsWith('.doc')) {
      return { mime: 'application/msword', ext: 'doc' };
    }
    return null;
  }

  // ---------- processing ----------
  private async processImage(file: Express.Multer.File, maxWidth: number, allowIco = false): Promise<{ buffer: Buffer; ext: string }> {
    if (!file?.buffer?.length) throw new BadRequestException('ملف فارغ');
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException(`الصورة ${file.originalname} تتجاوز 5 ميغابايت`);
    if (allowIco) {
      const ico = this.detectIco(file.buffer);
      if (ico) return { buffer: file.buffer, ext: ico.ext }; // stored as uploaded (sharp cannot read .ico)
    }
    const det = this.detectImage(file.buffer);
    if (!det) throw new BadRequestException(`الملف ${file.originalname} ليس صورة مدعومة (${allowIco ? 'ICO, ' : ''}JPG, PNG, WEBP, GIF)`);
    if (!sharp || det.ext === 'gif') return { buffer: file.buffer, ext: det.ext };
    try {
      let pipe = sharp(file.buffer, { failOn: 'error' }).rotate().resize({ width: maxWidth, withoutEnlargement: true });
      if (det.ext === 'jpg') pipe = pipe.jpeg({ quality: 80, mozjpeg: true });
      else if (det.ext === 'png') pipe = pipe.png({ compressionLevel: 9, palette: true });
      else pipe = pipe.webp({ quality: 80 });
      return { buffer: await pipe.toBuffer(), ext: det.ext };
    } catch {
      throw new BadRequestException(`الصورة ${file.originalname} تالفة أو غير قابلة للمعالجة`);
    }
  }

  private async writeNew(folder: string, ext: string, buffer: Buffer): Promise<string> {
    const rel = `${folder}/${randomUUID()}.${ext}`; // random names: no collisions, no guessing
    const abs = path.join(this.root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, buffer, { flag: 'wx' });
    return rel;
  }

  /** Validate + compress + store one image; returns the relative path. */
  async saveImage(file: Express.Multer.File, folder: string, maxWidth = 1920): Promise<string> {
    const { buffer, ext } = await this.processImage(file, maxWidth);
    return this.writeNew(folder, ext, buffer);
  }

  /** Site favicon: same as saveImage but also accepts .ico, and is kept small. */
  async saveFavicon(file: Express.Multer.File, folder: string): Promise<string> {
    const { buffer, ext } = await this.processImage(file, 256, true);
    return this.writeNew(folder, ext, buffer);
  }

  /**
   * Validates ALL files first, then writes them; if any write fails everything written is removed,
   * so a failed request never leaves orphan files (SRS REL-NFR-001).
   */
  async saveImages(files: Express.Multer.File[], folder: string, maxWidth = 1920): Promise<string[]> {
    const processed: { buffer: Buffer; ext: string }[] = [];
    for (const f of files ?? []) processed.push(await this.processImage(f, maxWidth));
    const written: string[] = [];
    try {
      for (const p of processed) written.push(await this.writeNew(folder, p.ext, p.buffer));
      return written;
    } catch (e) {
      await this.removeMany(written);
      this.logger.error(`saveImages failed: ${(e as Error).message}`);
      throw new BadRequestException('تعذر حفظ الملفات');
    }
  }

  async saveDocument(file: Express.Multer.File, folder: string): Promise<string> {
    if (!file?.buffer?.length) throw new BadRequestException('ملف فارغ');
    if (file.size > MAX_DOC_BYTES) throw new BadRequestException('المستند يتجاوز 10 ميغابايت');
    const det = this.detectDocument(file.buffer, file.originalname);
    if (!det) throw new BadRequestException('نوع المستند غير مدعوم (PDF, DOC, DOCX)');
    return this.writeNew(folder, det.ext, file.buffer);
  }

  /** News PDF: content must start with %PDF- (extension / client mime are never trusted). */
  async savePdf(file: Express.Multer.File, folder: string): Promise<string> {
    if (!file?.buffer?.length) throw new BadRequestException('ملف PDF فارغ');
    if (file.size > MAX_PDF_BYTES) throw new BadRequestException('ملف PDF يتجاوز 25 ميغابايت');
    if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new BadRequestException('الملف ليس PDF صالحاً');
    return this.writeNew(folder, 'pdf', file.buffer);
  }

  // ---------- deletion ----------
  async remove(rel: string | null | undefined): Promise<boolean> {
    if (!rel) return true;
    const abs = this.resolveSafe(rel);
    if (!abs) return false;
    try {
      await fs.unlink(abs);
      return true;
    } catch (e: any) {
      if (e.code === 'ENOENT') return true;
      // SRS 16: a failed physical delete is logged for manual follow-up and never blocks the operation
      this.logger.error(`MANUAL-CLEANUP: could not delete file "${rel}": ${e.message}`);
      return false;
    }
  }

  async removeMany(rels: (string | null | undefined)[]) {
    for (const r of rels) await this.remove(r);
  }

  // ---------- path safety ----------
  /** Maps a relative storage path to an absolute one, or null when it escapes the storage root. */
  resolveSafe(rel: string): string | null {
    if (!rel || rel.includes('\0') || !/^[A-Za-z0-9_\-./]+$/.test(rel)) return null;
    if (rel.split('/').some((seg) => seg === '..' || seg === '')) return null;
    const abs = path.resolve(this.root, rel);
    return abs.startsWith(this.root + path.sep) ? abs : null;
  }

  isPrivate(rel: string) {
    return rel.startsWith(PRIVATE_PREFIX);
  }

  /** Relative path -> public URL, e.g. news/abc.jpg -> /api/files/news/abc.jpg */
  url(rel: string | null | undefined): string | null {
    return rel ? `/api/files/${rel}` : null;
  }
}
