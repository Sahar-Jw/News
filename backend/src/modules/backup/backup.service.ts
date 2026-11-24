import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { spawn } from 'child_process';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { Readable } from 'stream';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { randomBytes } from 'crypto';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { backupKey, dumpDatabase, openProtected, writeEncryptedOrPlain } from './backup-core';
import { buildSchema } from './backup-schema';
import { ndjsonToSql } from './backup-sql';
import { ZipEntry, zipEntries } from './backup-zip';

export interface BackupInfo {
  id: string;
  createdAt: string;
  trigger: 'manual' | 'schedule';
  by: string | null;
  ok: boolean;
  error?: string;
  tables?: number;
  rows?: number;
  dbFile?: string;
  dbBytes?: number;
  filesFile?: string | null;
  filesBytes?: number;
  filesNote?: string;
  encrypted: boolean;
  durationMs: number;
}

const ID_RE = /^backup-\d{8}-\d{6}$/;
const FILE_RE = /^backup-\d{8}-\d{6}\.(json\.gz|files\.tar\.gz|meta\.json)$/;

/**
 * Backups of the database (every table, as compressed JSON) and of the uploaded files (when they live on this server's disk).
 *  BACKUP_DIR                where they are written (default ./backups). Point it at a mounted volume / a folder that is itself copied off the server.
 *  BACKUP_ENABLED=false      switches the daily automatic backup off
 *  BACKUP_INTERVAL_HOURS     automatic backup every N hours (default 24)
 *  BACKUP_KEEP               how many backups are kept; older ones are deleted (default 14)
 *  BACKUP_ENCRYPTION_KEY     encrypts the backup files (AES-256-GCM). Keep this key somewhere else: without it an encrypted backup cannot be restored.
 *  BACKUP_INCLUDE_FILES=false  database only
 *  BACKUP_STORAGE=local      keep the backups on BACKUP_DIR even when the uploaded files are in S3 (by default, with S3 storage, the backups go to the SAME
 *                            bucket under "<S3_PREFIX>/.backups/" - never served by any file URL - and BACKUP_DIR is only a temporary work folder)
 * Restoring is deliberately NOT a button: it replaces all data, so it is a command (npm run backup:restore, see README).
 */
@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupService.name);
  readonly dir = path.resolve(process.env.BACKUP_DIR || './backups');
  private running = false;
  /** meta files never change once written: read each from the bucket once */
  private readonly metaCache = new Map<string, BackupInfo>();
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly ds: DataSource,
    private readonly storage: FileStorageService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await fs.mkdir(this.dir, { recursive: true, mode: 0o700 }).catch((e) => this.logger.error(`Cannot create BACKUP_DIR ${this.dir}: ${e.message}`));
    if (process.env.BACKUP_ENABLED === 'false') {
      this.logger.warn('Automatic backups are OFF (BACKUP_ENABLED=false).');
      return;
    }
    if (!backupKey()) this.logger.warn('BACKUP_ENCRYPTION_KEY is not set: backup files (which contain personal data) are NOT encrypted.');
    const hours = Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS) || 24);
    this.logger.log(`Automatic backup every ${hours} h into ${this.dir}`);
    const tick = async () => {
      const last = (await this.list()).find((b) => b.ok);
      if (!last || Date.now() - new Date(last.createdAt).getTime() >= hours * 3600_000 - 60_000) await this.run('schedule', null).catch(() => undefined);
    };
    const safeTick = () => tick().catch((e) => this.logger.error(`Scheduled backup check failed: ${(e as Error).message}`));
    setTimeout(() => void safeTick(), 2 * 60_000).unref();
    this.timer = setInterval(() => void safeTick(), 30 * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** true = backups are kept in the S3 bucket (the container disk is wiped at every redeploy, the bucket is not) */
  private get useS3() {
    return this.storage.driver === 's3' && process.env.BACKUP_STORAGE !== 'local';
  }

  private stamp() {
    return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  }

  async run(trigger: 'manual' | 'schedule', actor: AuthUser | null): Promise<BackupInfo> {
    if (this.running) throw new ConflictException('هناك نسخة احتياطية قيد التنفيذ');
    this.running = true;
    const started = Date.now();
    const key = backupKey();
    const id = `backup-${this.stamp()}`;
    const info: BackupInfo = { id, createdAt: new Date().toISOString(), trigger, by: actor?.fullName ?? null, ok: false, encrypted: !!key, durationMs: 0 };
    try {
      await fs.mkdir(this.dir, { recursive: true, mode: 0o700 });
      const dbFile = `${id}.json.gz`;
      const r = await dumpDatabase(this.ds, path.join(this.dir, dbFile), key, { app: 'news-cms-backend', trigger });
      Object.assign(info, { tables: r.tables, rows: r.rows, dbFile, dbBytes: r.bytes });

      if (process.env.BACKUP_INCLUDE_FILES === 'false') info.filesNote = 'disabled';
      else if (this.storage.driver !== 'local') info.filesNote = 's3'; // the bucket is the store: enable versioning / replication there
      else {
        try {
          const filesFile = `${id}.files.tar.gz`;
          await this.tarFiles(path.join(this.dir, filesFile), key);
          info.filesFile = filesFile;
          info.filesBytes = (await fs.stat(path.join(this.dir, filesFile))).size;
        } catch (e) {
          info.filesNote = `files not archived: ${(e as Error).message}`.slice(0, 200);
          this.logger.warn(info.filesNote);
        }
      }
      if (this.useS3) {
        await this.storage.backupPut(dbFile, path.join(this.dir, dbFile));
        if (info.filesFile) await this.storage.backupPut(info.filesFile, path.join(this.dir, info.filesFile));
      }
      info.ok = true;
    } catch (e) {
      info.error = (e as Error).message.slice(0, 300);
      this.logger.error(`Backup ${id} failed: ${info.error}`);
    } finally {
      this.running = false;
      info.durationMs = Date.now() - started;
      await fs.writeFile(path.join(this.dir, `${id}.meta.json`), JSON.stringify(info), { mode: 0o600 }).catch(() => undefined);
    }
    if (this.useS3) {
      // the meta file goes up LAST: a backup is listed only when everything it points to is already in the bucket
      try {
        if (info.ok) await this.storage.backupPut(`${id}.meta.json`, path.join(this.dir, `${id}.meta.json`));
      } catch (e) {
        info.ok = false;
        info.error = (e as Error).message.slice(0, 300);
        this.logger.error(`Backup ${id} failed: ${info.error}`);
      }
      if (!info.ok) for (const n of [info.dbFile, info.filesFile]) if (n) await this.storage.backupDelete(n).catch(() => undefined);
      // the bucket is the store now: the local copy was only a work file
      for (const ext of ['json.gz', 'files.tar.gz', 'meta.json']) await fs.rm(path.join(this.dir, `${id}.${ext}`), { force: true }).catch(() => undefined);
    }
    await this.audit.log({ category: 'backup', action: info.ok ? 'create' : 'create.failed', description: info.ok ? `نسخة احتياطية ${id} (${trigger === 'manual' ? 'يدوية' : 'تلقائية'})` : `فشل النسخ الاحتياطي ${id}`, actorId: actor?.id ?? null, details: { ok: info.ok, rows: info.rows, tables: info.tables, error: info.error } });
    if (info.ok) await this.prune();
    if (!info.ok) throw new BadRequestException(`فشل النسخ الاحتياطي: ${info.error}`);
    return info;
  }

  /** tar is present in the Docker image (Alpine/busybox) and on every Linux host; the archive goes through the same encryption as the database */
  private tarFiles(dest: string, key: Buffer | null): Promise<void> {
    return new Promise((resolve, reject) => {
      const t = spawn('tar', ['-czf', '-', '-C', this.storage.root, '.'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let err = '';
      t.stderr.on('data', (d) => (err += d));
      t.on('error', reject);
      const written = writeEncryptedOrPlain(t.stdout, dest, key);
      t.on('close', async (code) => {
        // tar exits 1 when a file changed while being read: the archive is still usable
        if (code !== 0 && code !== 1) {
          await written.catch(() => undefined);
          await fs.rm(dest, { force: true });
          return reject(new Error(`tar exited with ${code}: ${err.trim().slice(0, 120)}`));
        }
        written.then(() => resolve(), reject);
      });
    });
  }

  private async listS3(): Promise<BackupInfo[]> {
    let names: string[];
    try { names = await this.storage.backupNames(); } catch (e) { throw new BadGatewayException(`تعذّر قراءة النسخ من S3: ${(e as Error).message}`.slice(0, 300)); }
    const present = new Set(names);
    const out: BackupInfo[] = [];
    for (const n of names.filter((x) => x.endsWith('.meta.json') && ID_RE.test(x.replace('.meta.json', '')))) {
      const id = n.replace('.meta.json', '');
      try {
        let m = this.metaCache.get(id);
        if (!m) { m = JSON.parse(await this.storage.backupText(n)) as BackupInfo; this.metaCache.set(id, m); }
        if (m.ok && m.dbFile && !present.has(m.dbFile)) continue; // removed from the bucket by hand
        out.push(m);
      } catch { /* unreadable meta: skip */ }
    }
    for (const id of [...this.metaCache.keys()]) if (!present.has(`${id}.meta.json`)) this.metaCache.delete(id);
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async list(): Promise<BackupInfo[]> {
    if (this.useS3) return this.listS3();
    let names: string[] = [];
    try { names = await fs.readdir(this.dir); } catch { return []; }
    const out: BackupInfo[] = [];
    for (const n of names.filter((x) => x.endsWith('.meta.json') && ID_RE.test(x.replace('.meta.json', '')))) {
      try {
        const m: BackupInfo = JSON.parse(await fs.readFile(path.join(this.dir, n), 'utf8'));
        if (m.ok && m.dbFile) {
          // the file may have been removed by hand: report what is really there
          const present = await fs.stat(path.join(this.dir, m.dbFile)).then(() => true).catch(() => false);
          if (!present) continue;
        }
        out.push(m);
      } catch { /* unreadable meta: skip */ }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  private async prune() {
    const keep = Math.max(1, Number(process.env.BACKUP_KEEP) || 14);
    const all = await this.list();
    const okOnes = all.filter((b) => b.ok);
    for (const b of [...okOnes.slice(keep), ...all.filter((x) => !x.ok).slice(5)]) await this.removeFiles(b.id).catch(() => undefined);
  }

  private async removeFiles(id: string) {
    if (!ID_RE.test(id)) throw new NotFoundException('النسخة غير موجودة');
    if (this.useS3) {
      // the meta file first, so a half-deleted backup is never listed
      for (const ext of ['meta.json', 'json.gz', 'files.tar.gz']) await this.storage.backupDelete(`${id}.${ext}`);
      this.metaCache.delete(id);
      return;
    }
    for (const ext of ['json.gz', 'files.tar.gz', 'meta.json']) await fs.rm(path.join(this.dir, `${id}.${ext}`), { force: true });
  }

  async remove(id: string, actor: AuthUser) {
    if (!(await this.list()).some((b) => b.id === id)) throw new NotFoundException('النسخة غير موجودة');
    await this.removeFiles(id);
    await this.audit.log({ category: 'backup', action: 'delete', description: `حذف النسخة الاحتياطية ${id}`, actorId: actor.id });
    return { deleted: true };
  }

  /**
   * One file of a backup (only names this service made; never a path from the client).
   * readable = true: the file is decrypted on the way out (a plain .json.gz / .tar.gz that any archive tool opens), so an encrypted backup can be
   * looked at or restored without the key. Needs the same permission as the download, and is written to the audit log.
   */
  async fileOf(id: string, kind: 'db' | 'files', actor: AuthUser, readable = false) {
    const b = (await this.list()).find((x) => x.id === id && x.ok);
    const name = kind === 'db' ? b?.dbFile : b?.filesFile;
    if (!b || !name || !FILE_RE.test(name)) throw new NotFoundException('الملف غير موجود');
    await this.audit.log({ category: 'backup', action: readable && b.encrypted ? 'download.readable' : 'download', description: `تنزيل ${name}${readable && b.encrypted ? ' (بعد فك التشفير)' : ''}`, actorId: actor.id });
    if (!readable || !b.encrypted) {
      if (this.useS3) return { name, stream: (await this.storage.backupStream(name)).stream as Readable };
      return { name, stream: createReadStream(path.join(this.dir, name)) as Readable };
    }
    return { name, stream: await this.openPlain(name) };
  }

  /** a backup file as plain bytes: decrypted when it was encrypted (needs BACKUP_ENCRYPTION_KEY). From the bucket it is first copied to a work file, because decryption needs the authentication tag at the end of the file. */
  private async openPlain(name: string): Promise<Readable> {
    const key = backupKey();
    if (!key) throw new BadRequestException('الملف مشفّر ولا يوجد BACKUP_ENCRYPTION_KEY على الخادم لفك تشفيره.');
    let file = path.join(this.dir, name);
    let temp: string | null = null;
    if (this.useS3) {
      temp = path.join(this.dir, `${name}.${randomBytes(4).toString('hex')}.tmp`);
      file = temp;
      await fs.mkdir(this.dir, { recursive: true, mode: 0o700 });
      await pipeline((await this.storage.backupStream(name)).stream, createWriteStream(temp, { mode: 0o600 }));
    }
    try {
      const stream = (await openProtected(file, key)) as Readable;
      if (temp) stream.once('close', () => void fs.rm(temp!, { force: true }));
      return stream;
    } catch (e) {
      if (temp) await fs.rm(temp, { force: true });
      throw new BadRequestException(`تعذّر فك التشفير: ${(e as Error).message}`.slice(0, 200));
    }
  }

  /**
   * The backup as a ZIP holding one folder: the restorable SQL script (backup-X/backup-X.sql) and, when withFiles, every uploaded file
   * in a "files" folder (backup-X/files/news/abc.jpg ...). The files are read from storage at download time (disk or S3), so they are the
   * current ones, not a frozen copy from the minute the backup ran.
   * protectedZip = true: the ZIP is AES-256 password protected, the password being BACKUP_ENCRYPTION_KEY (7-Zip / WinRAR / WinZip ask for it).
   */
  async sqlZip(id: string, actor: AuthUser, protectedZip: boolean, withFiles = true) {
    const b = (await this.list()).find((x) => x.id === id && x.ok && x.dbFile);
    if (!b || !b.dbFile || !FILE_RE.test(b.dbFile)) throw new NotFoundException('الملف غير موجود');
    const password = protectedZip ? (process.env.BACKUP_ENCRYPTION_KEY ?? '').trim() : '';
    if (protectedZip && !password) throw new BadRequestException('لا يوجد BACKUP_ENCRYPTION_KEY على الخادم، فلا يمكن تنزيل نسخة مشفّرة.');
    const files = withFiles && process.env.BACKUP_INCLUDE_FILES !== 'false';
    await this.audit.log({ category: 'backup', action: protectedZip ? 'download.sql.encrypted' : 'download.sql', description: `تنزيل ${id}.zip ${protectedZip ? '(مشفّر بكلمة مرور)' : '(غير مشفّر)'}${files ? ' مع الملفات' : ''}`, actorId: actor.id });
    const gz = b.encrypted
      ? await this.openPlain(b.dbFile)
      : this.useS3 ? (await this.storage.backupStream(b.dbFile)).stream : (createReadStream(path.join(this.dir, b.dbFile)) as Readable);
    const gunzip = createGunzip();
    gz.on('error', (e) => gunzip.destroy(e));
    gz.pipe(gunzip);
    const raw = ndjsonToSql(gunzip, (schema, tables) => buildSchema(this.ds, schema, tables));
    gunzip.on('error', (e) => raw.destroy(e));
    // wait for the first piece (the structure part): a broken backup or a database error then answers with a normal error message instead of a cut-off download
    const it = raw[Symbol.asyncIterator]();
    let first: IteratorResult<unknown>;
    try { first = await it.next(); } catch (e) { gz.destroy(); throw new BadRequestException(`تعذّر تجهيز ملف SQL: ${(e as Error).message}`.slice(0, 200)); }
    const sql = Readable.from((async function* () { if (!first.done) yield first.value as Buffer; for await (const c of { [Symbol.asyncIterator]: () => it }) yield c as Buffer; })());
    const storage = this.storage;
    async function* entries(): AsyncGenerator<ZipEntry> {
      yield { name: `${id}/${id}.sql`, open: () => sql };
      if (!files) return;
      for await (const rel of storage.listStoredFiles()) {
        yield { name: `${id}/files/${rel}`, open: () => storage.openStored(rel), store: /\.(jpe?g|png|gif|webp|pdf|docx)$/i.test(rel) };
      }
    }
    return { name: `${id}${protectedZip ? '-encrypted' : ''}.zip`, stream: zipEntries(entries(), password || undefined) };
  }

  /**
   * Is BACKUP_DIR on its own mount (a volume) or on the container's own disk? A container disk is wiped at every redeploy / restart,
   * and the backups with it, so the page would show an empty list afterwards. A mounted volume has another device id than "/".
   */
  private async onVolume(): Promise<boolean> {
    try {
      const [d, root] = await Promise.all([fs.stat(this.dir), fs.stat(path.parse(this.dir).root)]);
      return d.dev !== root.dev;
    } catch { return true; } // cannot tell (e.g. Windows paths): do not warn
  }

  async status() {
    return { store: this.useS3 ? 's3' : 'disk', persistent: this.useS3 || (await this.onVolume()), dir: this.dir, running: this.running, encrypted: !!backupKey(), automatic: process.env.BACKUP_ENABLED !== 'false', intervalHours: Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS) || 24), keep: Math.max(1, Number(process.env.BACKUP_KEEP) || 14), filesDriver: this.storage.driver };
  }
}
