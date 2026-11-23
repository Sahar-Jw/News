import 'dotenv/config';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { backupKey, openProtected } from '../modules/backup/backup-core';

/**
 * npm run backup:decrypt -- <encrypted backup file> <output file>
 * (production: node dist/database/decrypt-backup.js <in> <out>)
 * Writes the backup without encryption (a plain .json.gz / .tar.gz). Needs BACKUP_ENCRYPTION_KEY = the key the backup was made with.
 * A file that is not encrypted is copied as it is. A wrong key fails at the end (nothing usable is reported as done).
 */
async function main() {
  const [src, dest] = process.argv.slice(2);
  if (!src || !dest) {
    console.error('Usage: backup:decrypt <encrypted backup> <output file>   (set BACKUP_ENCRYPTION_KEY)');
    process.exit(2);
  }
  await pipeline(await openProtected(src, backupKey()), createWriteStream(dest, { mode: 0o600 }));
  console.log(`Written: ${dest}`);
}
main().catch((e) => {
  console.error(`Decrypt FAILED: ${e.message}`);
  process.exit(1);
});
