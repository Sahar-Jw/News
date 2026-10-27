import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { MAX_DOC_BYTES, MAX_IMAGE_BYTES, MAX_PDF_BYTES } from '../../common/constants';

type Detected = { mime: string; ext: string };

/** A file streamed out of the S3 bucket (see FileStorageService.openS3). */
export interface S3File {
  notModified: boolean; // true = the browser's cached copy is still current (no body)
  body: Readable | null;
  contentType: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const mimeFor = (name: string) => MIME_BY_EXT[path.extname(name).slice(1).toLowerCase()] || 'application/octet-stream';
const SAFE_KEY = /^[A-Za-z0-9_\-./]+$/; // same rule resolveSafe() applies to every served path
const SEED_MARKER = '.seeded';

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
  /** 'local' = files on disk / a mounted volume (STORAGE_DIR). 's3' = S3-compatible bucket (S3_* variables). */
  readonly driver: 'local' | 's3';
  private readonly s3: S3Client | null = null;
  private readonly bucket: string = '';
  private readonly seedDir: string;
  private readonly seedEnabled: boolean;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.get<string>('STORAGE_DIR') || './storage');
    this.seedDir = path.resolve(config.get<string>('SEED_DIR') || './storage-seed');
    this.seedEnabled = config.get<string>('S3_SEED') !== 'false';

    const bucket = (config.get<string>('S3_BUCKET') || '').trim();
    const wanted = (config.get<string>('STORAGE_DRIVER') || (bucket ? 's3' : 'local')).trim().toLowerCase();
    this.driver = wanted === 's3' ? 's3' : 'local';
    if (this.driver === 's3') {
      const accessKeyId = (config.get<string>('S3_ACCESS_KEY_ID') || config.get<string>('S3_ACCESS_KEY') || '').trim();
      const secretAccessKey = (config.get<string>('S3_SECRET_ACCESS_KEY') || config.get<string>('S3_SECRET_KEY') || '').trim();
      if (!bucket || !accessKeyId || !secretAccessKey) {
        throw new Error('S3 storage needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (S3_ENDPOINT / S3_REGION are optional)');
      }
      let endpoint = (config.get<string>('S3_ENDPOINT') || '').trim();
      if (endpoint && !/^https?:\/\//i.test(endpoint)) endpoint = `https://${endpoint}`;
      this.bucket = bucket;
      this.s3 = new S3Client({
        region: (config.get<string>('S3_REGION') || '').trim() || 'us-east-1',
        endpoint: endpoint || undefined,
        forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE') !== 'false', // most S3-compatible providers need path-style
        credentials: { accessKeyId, secretAccessKey },
        // newer SDKs add CRC32 checksums to every request, which many S3-compatible providers reject
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
    }
  }

  async onModuleInit() {
    if (this.driver === 's3') await this.initS3();
    else for (const f of [...PUBLIC_FOLDERS, 'private/cv', 'tmp']) await fs.mkdir(path.join(this.root, f), { recursive: true });
    if (!sharp) this.logger.warn('"sharp" is not installed: images will be validated but NOT resized/compressed.');
  }

  // ---------- S3 ----------
  private errText(e: any) {
    return `${e?.name ?? 'Error'}${e?.$metadata?.httpStatusCode ? ` (HTTP ${e.$metadata.httpStatusCode})` : ''}: ${e?.message ?? e}`;
  }

  private async initS3() {
    try {
      await this.s3!.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 storage ready: bucket "${this.bucket}"`);
    } catch (e) {
      // not fatal: the API still starts, and the seed below / every upload will show the precise error
      this.logger.error(`S3 bucket "${this.bucket}" check failed - ${this.errText(e)}`);
    }
    if (this.seedEnabled) await this.seedBucket();
  }

  private async listSeedFiles(dir: string, prefix = ''): Promise<string[]> {
    const out: string[] = [];
    for (const d of await fs.readdir(dir, { withFileTypes: true })) {
      if (d.name.startsWith('.')) continue; // .gitkeep etc.
      const rel = prefix ? `${prefix}/${d.name}` : d.name;
      if (d.isDirectory()) out.push(...(await this.listSeedFiles(path.join(dir, d.name), rel)));
      else if (d.isFile()) out.push(rel);
    }
    return out;
  }

  /**
   * Uploads the files shipped with the app (storage-seed/, the images committed in the repo) into the bucket ONCE,
   * so a new bucket is not empty. A ".seeded" marker object is written only after every file arrived; after that
   * nothing is copied again, so images deleted later from the admin panel never come back.
   */
  private async seedBucket() {
    try {
      await this.s3!.send(new HeadObjectCommand({ Bucket: this.bucket, Key: SEED_MARKER }));
      this.logger.log('S3 bucket already seeded - skipping');
      return;
    } catch {
      /* marker missing (or not readable) -> seed */
    }
    let files: string[];
    try {
      files = await this.listSeedFiles(this.seedDir);
    } catch {
      this.logger.log(`S3 seed folder not found (${this.seedDir}) - nothing to upload`);
      return;
    }
    const keys = files.filter((k) => SAFE_KEY.test(k) && !k.split('/').some((seg) => seg === '..' || seg === ''));
    const skipped = files.length - keys.length;
    this.logger.log(`S3 seeding: uploading ${keys.length} files from ${this.seedDir}${skipped ? ` (${skipped} skipped: unsupported file names)` : ''}`);
    let done = 0;
    let failed = 0;
    const BATCH = 8;
    for (let i = 0; i < keys.length; i += BATCH) {
      await Promise.all(
        keys.slice(i, i + BATCH).map(async (key) => {
          try {
            await this.s3!.send(
              new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: await fs.readFile(path.join(this.seedDir, key)),
                ContentType: mimeFor(key),
                CacheControl: key.startsWith(PRIVATE_PREFIX) ? 'private, no-store' : 'public, max-age=604800',
              }),
            );
            done++;
          } catch (e) {
            failed++;
            if (failed <= 5) this.logger.error(`S3 seed failed for "${key}" - ${this.errText(e)}`);
          }
        }),
      );
    }
    if (failed === 0) {
      try {
        await this.s3!.send(new PutObjectCommand({ Bucket: this.bucket, Key: SEED_MARKER, Body: new Date().toISOString(), ContentType: 'text/plain' }));
      } catch (e) {
        this.logger.error(`S3 seed marker could not be written - ${this.errText(e)}`);
        return;
      }
      this.logger.log(`S3 seeding complete: ${done} files uploaded`);
    } else {
      this.logger.error(`S3 seeding INCOMPLETE: ${done} uploaded, ${failed} failed (will retry on next start)`);
    }
  }

  /** Streams one stored file from the bucket (null = not found). Honors If-None-Match so browsers can revalidate cheaply. */
  async openS3(rel: string, ifNoneMatch?: string): Promise<S3File | null> {
    if (this.driver !== 's3' || !this.resolveSafe(rel) || rel.split('/').some((seg) => seg.startsWith('.'))) return null;
    try {
      const out = await this.s3!.send(new GetObjectCommand({ Bucket: this.bucket, Key: rel, IfNoneMatch: ifNoneMatch || undefined }));
      return {
        notModified: false,
        body: out.Body as Readable,
        contentType: mimeFor(rel) !== 'application/octet-stream' ? mimeFor(rel) : out.ContentType || 'application/octet-stream',
        contentLength: out.ContentLength,
        etag: out.ETag,
        lastModified: out.LastModified,
      };
    } catch (e: any) {
      const status = e?.$metadata?.httpStatusCode;
      if (status === 304) return { notModified: true, body: null, contentType: '', etag: ifNoneMatch };
      if (status === 404 || e?.name === 'NoSuchKey' || e?.name === 'NotFound') return null;
      this.logger.error(`S3 read failed for "${rel}" - ${this.errText(e)}`);
      return null;
    }
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
    if (this.driver === 's3') {
      await this.s3!.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: rel,
          Body: buffer,
          ContentType: mimeFor(rel),
          CacheControl: rel.startsWith(PRIVATE_PREFIX) ? 'private, no-store' : 'public, max-age=604800',
        }),
      );
      return rel;
    }
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
      if (this.driver === 's3') {
        await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: rel })); // deleting a missing key is not an error
        return true;
      }
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
