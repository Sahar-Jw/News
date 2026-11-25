import { createCipheriv, createHmac, pbkdf2Sync, randomBytes } from 'crypto';
import { Readable, Transform } from 'stream';
import * as zlib from 'zlib';
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

const u64 = (n: number) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
// zlib.crc32 (Node 22+) is native and much faster than the table loop; older Node keeps the loop
const nativeCrc: ((d: Buffer, v?: number) => number) | undefined = (zlib as unknown as { crc32?: (d: Buffer, v?: number) => number }).crc32;
const crc = (value: number, buf: Buffer) => (nativeCrc ? nativeCrc(buf, value) : crc32(value, buf));

/**
 * A streamed ZIP of many entries (optionally protected with a password, AES-256 per entry). Nothing is buffered: each file flows through.
 * NO SIZE LIMITS: every entry is written in ZIP64 form (8-byte sizes and offsets, ZIP64 end records), so files and the whole backup can be
 * larger than 4 GB and the ZIP can hold more than 65,535 files. 7-Zip, WinRAR, WinZip, unzip, macOS and Windows 10+ open ZIP64.
 */
export function zipEntries(entries: AsyncIterable<ZipEntry> | Iterable<ZipEntry>, password?: string): Readable {
  const aes = !!password;
  const flags = 0x0008 | 0x0800 | (aes ? 0x0001 : 0); // data descriptor | UTF-8 name | encrypted
  const method = aes ? 99 : 8;
  const aesExtra = aes ? Buffer.concat([u16(0x9901), u16(7), u16(2), Buffer.from('AE'), Buffer.from([3]), u16(8)]) : Buffer.alloc(0);
  const version = aes ? 51 : 45; // 4.5 = ZIP64
  const FFFF32 = 0xffffffff;

  async function* gen() {
    const { time, date } = dosTime(new Date());
    const central: Buffer[] = [];
    let offset = 0; // where the next local header starts
    for await (const entry of entries as AsyncIterable<ZipEntry>) {
      let source: Readable | null;
      try { source = await entry.open(); } catch { source = null; }
      if (!source) continue; // file vanished between the listing and now
      const name = Buffer.from(entry.name, 'utf8');
      // streamed entry: sizes are not known yet, so the local header says "see the ZIP64 field" (0 / 0) and a 24-byte ZIP64 data descriptor follows the data
      const localExtra = Buffer.concat([u16(0x0001), u16(16), u64(0), u64(0), aesExtra]);
      const local = Buffer.concat([u32(0x04034b50), u16(version), u16(flags), u16(method), u16(time), u16(date), u32(0), u32(FFFF32), u32(FFFF32), u16(name.length), u16(localExtra.length), name, localExtra]);
      const entryOffset = offset;
      yield local;
      let written = 0;
      let usize = 0;
      let sum = 0;
      const tap = new Transform({ transform(chunk: Buffer, _e, cb) { sum = crc(sum, chunk); usize += chunk.length; cb(null, chunk); } });
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
      const crcField = aes ? 0 : sum; // AE-2 keeps the CRC field at 0 (the HMAC authenticates the data)
      yield Buffer.concat([u32(0x08074b50), u32(crcField), u64(written), u64(usize)]);
      offset += local.length + written + 24;
      const centralExtra = Buffer.concat([u16(0x0001), u16(24), u64(usize), u64(written), u64(entryOffset), aesExtra]);
      central.push(Buffer.concat([u32(0x02014b50), u16(version), u16(version), u16(flags), u16(method), u16(time), u16(date), u32(crcField), u32(FFFF32), u32(FFFF32), u16(name.length), u16(centralExtra.length), u16(0), u16(0), u16(0), u32(0), u32(FFFF32), name, centralExtra]));
    }
    const cd = Buffer.concat(central);
    yield cd;
    const zip64Offset = offset + cd.length;
    // ZIP64 end of central directory + its locator, then the classic end record with "see ZIP64" markers
    yield Buffer.concat([u32(0x06064b50), u64(44), u16(45), u16(45), u32(0), u32(0), u64(central.length), u64(central.length), u64(cd.length), u64(offset)]);
    yield Buffer.concat([u32(0x07064b50), u32(0), u64(zip64Offset), u32(1)]);
    yield Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(0xffff), u16(0xffff), u32(FFFF32), u32(FFFF32), u16(0)]);
  }
  return Readable.from(gen());
}

/** One entry (e.g. "backup-X/backup-X.sql") as a streamed ZIP; password => AES-256 encrypted. */
export function zipSingle(entryName: string, source: Readable, password?: string): Readable {
  return zipEntries([{ name: entryName, open: () => source }], password);
}
