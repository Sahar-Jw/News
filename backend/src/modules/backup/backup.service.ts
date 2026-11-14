import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { spawn } from 'child_process';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { FileStorageService } from '../files/file-storage.service';
import { backupKey, dumpDatabase, writeEncryptedOrPlain } from './backup-core';

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
 * Restoring is deliberately NOT a button: it replaces all data, so it is a command (npm run backup:restore, see README).
 */
@Injectable()
export class BackupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupService.name);
  readonly dir = path.resolve(process.env.BACKUP_DIR || './backups');
  private running = false;
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
    setTimeout(() => void tick(), 2 * 60_000).unref();
    this.timer = setInterval(() => void tick(), 30 * 60_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
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
      info.ok = true;
    } catch (e) {
      info.error = (e as Error).message.slice(0, 300);
      this.logger.error(`Backup ${id} failed: ${info.error}`);
    } finally {
      this.running = false;
      info.durationMs = Date.now() - started;
      await fs.writeFile(path.join(this.dir, `${id}.meta.json`), JSON.stringify(info), { mode: 0o600 }).catch(() => undefined);
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

  async list(): Promise<BackupInfo[]> {
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
    for (const ext of ['json.gz', 'files.tar.gz', 'meta.json']) await fs.rm(path.join(this.dir, `${id}.${ext}`), { force: true });
  }

  async remove(id: string, actor: AuthUser) {
    if (!(await this.list()).some((b) => b.id === id)) throw new NotFoundException('النسخة غير موجودة');
    await this.removeFiles(id);
    await this.audit.log({ category: 'backup', action: 'delete', description: `حذف النسخة الاحتياطية ${id}`, actorId: actor.id });
    return { deleted: true };
  }

  /** the path of one file of a backup (only names this service made; never a path from the client) */
  async fileOf(id: string, kind: 'db' | 'files', actor: AuthUser) {
    const b = (await this.list()).find((x) => x.id === id && x.ok);
    const name = kind === 'db' ? b?.dbFile : b?.filesFile;
    if (!b || !name || !FILE_RE.test(name)) throw new NotFoundException('الملف غير موجود');
    await this.audit.log({ category: 'backup', action: 'download', description: `تنزيل ${name}`, actorId: actor.id });
    return { name, stream: createReadStream(path.join(this.dir, name)) };
  }

  status() {
    return { dir: this.dir, running: this.running, encrypted: !!backupKey(), automatic: process.env.BACKUP_ENABLED !== 'false', intervalHours: Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS) || 24), keep: Math.max(1, Number(process.env.BACKUP_KEEP) || 14), filesDriver: this.storage.driver };
  }
}
