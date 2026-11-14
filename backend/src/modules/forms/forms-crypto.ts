import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

/** AES-256-GCM for the "sensitive" answers of a form. The key is FORMS_ENCRYPTION_KEY (any long secret; hashed to 32 bytes). Without a key nothing is encrypted. */
const keyOf = (): Buffer | null => {
  const k = (process.env.FORMS_ENCRYPTION_KEY ?? '').trim();
  return k ? createHash('sha256').update(k).digest() : null;
};

export const encryptionEnabled = () => !!keyOf();

export function encryptValue(v: unknown): string | unknown {
  const key = keyOf();
  if (!key || v === undefined || v === null) return v;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(v), 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), data]).toString('base64');
}

export const isEncrypted = (v: unknown): v is string => typeof v === 'string' && v.startsWith(PREFIX);

/** returns null (not an error) when the key is missing or wrong, so one bad row never breaks a list */
export function decryptValue(v: unknown): unknown {
  if (!isEncrypted(v)) return v;
  const key = keyOf();
  if (!key) return null;
  try {
    const raw = Buffer.from(v.slice(PREFIX.length), 'base64');
    const d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
  } catch {
    return null;
  }
}
