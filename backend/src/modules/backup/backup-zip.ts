import { createCipheriv, createHmac, pbkdf2Sync, randomBytes } from 'crypto';
import { Readable, Transform } from 'stream';
import { createDeflateRaw } from 'zlib';

/**
 * A streamed ZIP of one or many entries (optionally protected with a password: WinZip AES-256, opened by 7-Zip / WinRAR / WinZip). No dependency: the ZIP is written here.
 */

// ---------------------------------------------------------------- ZIP ----------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (crc: number, buf: Buffer) => {
  let c = ~crc >>> 0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
};

const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const dosTime = (d: Date) => ({ time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() });

/** WinZip AES-256 (AE-2): the counter is little-endian and starts at 1, so it is done block by block with AES-ECB. */
class AesCtrLe {
  private counter = 0n;
  private pad = Buffer.alloc(0);
  private readonly ecb;
  constructor(key: Buffer) { this.ecb = createCipheriv('aes-256-ecb', key, null); this.ecb.setAutoPadding(false); }
  update(data: Buffer): Buffer {
    const blocks = Math.ceil(Math.max(0, data.length - this.pad.length) / 16);
    if (blocks > 0) {
      const ctr = Buffer.alloc(blocks * 16);
      for (let i = 0; i < blocks; i++) { this.counter += 1n; ctr.writeBigUInt64LE(this.counter, i * 16); }
      this.pad = Buffer.concat([this.pad, this.ecb.update(ctr)]);
    }
    const out = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) out[i] = data[i] ^ this.pad[i];
    this.pad = this.pad.subarray(data.length);
    return out;
  }
}

/** One file of the ZIP. `open` is called only when it is its turn, so thousands of entries never hold thousands of open streams. Return null to skip it (e.g. deleted meanwhile). */
export interface ZipEntry {
  name: string;
  open: () => Readable | null | Promise<Readable | null>;
  /** already compressed (jpg, png, pdf, ...): stored without deflating, which is much faster */
  store?: boolean;
}

/** A streamed ZIP of many entries (optionally protected with a password, AES-256 per entry). Nothing is buffered: each file flows through. */
export function zipEntries(entries: AsyncIterable<ZipEntry> | Iterable<ZipEntry>, password?: string): Readable {
  const aes = !!password;
  const flags = 0x0008 | 0x0800 | (aes ? 0x0001 : 0); // data descriptor | UTF-8 name | encrypted
  const method = aes ? 99 : 8;
  const extra = aes ? Buffer.concat([u16(0x9901), u16(7), u16(2), Buffer.from('AE'), Buffer.from([3]), u16(8)]) : Buffer.alloc(0);
  const version = aes ? 51 : 20;

  async function* gen() {
    const { time, date } = dosTime(new Date());
    const central: Buffer[] = [];
    let offset = 0; // where the next local header starts
    for await (const entry of entries as AsyncIterable<ZipEntry>) {
      let source: Readable | null;
      try { source = await entry.open(); } catch { source = null; }
      if (!source) continue; // file vanished between the listing and now
      const name = Buffer.from(entry.name, 'utf8');
      const local = Buffer.concat([u32(0x04034b50), u16(version), u16(flags), u16(method), u16(time), u16(date), u32(0), u32(0), u32(0), u16(name.length), u16(extra.length), name, extra]);
      const entryOffset = offset;
      yield local;
      let written = 0;
      let usize = 0;
      let crc = 0;
      const tap = new Transform({ transform(chunk: Buffer, _e, cb) { crc = crc32(crc, chunk); usize += chunk.length; cb(null, chunk); } });
      const deflate = createDeflateRaw({ level: entry.store ? 0 : 6 });
      source.on('error', (e) => tap.destroy(e));
      tap.on('error', (e) => deflate.destroy(e));
      source.pipe(tap).pipe(deflate);
      let cipher: AesCtrLe | null = null;
      let hmac: ReturnType<typeof createHmac> | null = null;
      if (aes) {
        const salt = randomBytes(16);
        const k = pbkdf2Sync(Buffer.from(password!, 'utf8'), salt, 1000, 66, 'sha1');
        cipher = new AesCtrLe(k.subarray(0, 32));
        hmac = createHmac('sha1', k.subarray(32, 64));
        const head = Buffer.concat([salt, k.subarray(64, 66)]);
        written += head.length;
        yield head;
      }
      for await (const chunk of deflate as AsyncIterable<Buffer>) {
        const out = cipher ? cipher.update(chunk) : chunk;
        hmac?.update(out);
        written += out.length;
        yield out;
      }
      if (hmac) { const tag = hmac.digest().subarray(0, 10); written += tag.length; yield tag; }
      if (written > 0xfffffffe || usize > 0xfffffffe) throw new Error('A file in the backup is too large for a ZIP (4 GB): use the command-line backup file.');
      const crcField = aes ? 0 : crc; // AE-2 keeps the CRC field at 0 (the HMAC authenticates the data)
      yield Buffer.concat([u32(0x08074b50), u32(crcField), u32(written), u32(usize)]);
      offset += local.length + written + 16;
      if (offset > 0xfffffffe) throw new Error('The backup is too large for a ZIP (4 GB): use the command-line backup file.');
      central.push(Buffer.concat([u32(0x02014b50), u16(version), u16(version), u16(flags), u16(method), u16(time), u16(date), u32(crcField), u32(written), u32(usize), u16(name.length), u16(extra.length), u16(0), u16(0), u16(0), u32(0), u32(entryOffset), name, extra]));
    }
    if (central.length > 0xffff) throw new Error('Too many files for a ZIP (65535): use the command-line backup file.');
    const cd = Buffer.concat(central);
    yield cd;
    yield Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(cd.length), u32(offset), u16(0)]);
  }
  return Readable.from(gen());
}

/** One entry (e.g. "backup-X/backup-X.sql") as a streamed ZIP; password => AES-256 encrypted. */
export function zipSingle(entryName: string, source: Readable, password?: string): Readable {
  return zipEntries([{ name: entryName, open: () => source }], password);
}
