import 'dotenv/config';
import 'reflect-metadata';
import dataSource from './data-source';
import { backupKey, restoreDatabase } from '../modules/backup/backup-core';

/**
 * npm run backup:restore -- <path to backup-YYYYMMDD-HHMMSS.json.gz> --yes
 * (production: node dist/database/restore-backup.js <file> --yes)
 * REPLACES the content of every table with the backup's. Run the migrations first, stop the API while it runs, and set
 * BACKUP_ENCRYPTION_KEY when the backup is encrypted. The uploaded files are restored separately:
 *   tar -xzf backup-...files.tar.gz -C <STORAGE_DIR>      (decrypt it first if it is encrypted: see README)
 */
async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith('--') || !process.argv.includes('--yes')) {
    console.error('Usage: backup:restore <backup .json.gz> --yes   (this REPLACES all data in the database)');
    process.exit(2);
  }
  await dataSource.initialize();
  try {
    const r = await restoreDatabase(dataSource, file, backupKey(), (m) => console.log(m));
    console.log(`Restore complete: ${r.rows} rows.`);
  } finally {
    await dataSource.destroy();
  }
}
main().catch((e) => {
  console.error(`Restore FAILED (nothing was changed): ${e.message}`);
  process.exit(1);
});
