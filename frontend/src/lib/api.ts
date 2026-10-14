export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').replace(/\/$/, '');

/** Backend returns file URLs like /api/files/news/x.jpg – rebase them on the configured API URL. */
export function fileUrl(p?: string | null): string {
  if (!p) return '';
  if (/^https?:\/\//.test(p)) return p;
  return API_URL + p.replace(/^\/api/, '');
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Q = Record<string, string | number | boolean | null | undefined>;
export function qs(params?: Q): string {
  if (!params) return '';
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
}

async function parse(res: Response) {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const m = data?.message;
    throw new ApiError(res.status, Array.isArray(m) ? m.join(' • ') : m || res.statusText || 'Error');
  }
  return data;
}

export async function api<T = any>(path: string, opts: { method?: string; params?: Q; body?: any; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(API_URL + path + qs(opts.params), { method: opts.method ?? 'GET', headers, body, credentials: 'include' });
  return parse(res);
}

/** Download an export (csv/xlsx) – sends the same filters as the table. */
export async function download(path: string, params: Q, fallbackName: string) {
  const res = await fetch(API_URL + path + qs(params), { credentials: 'include' });
  if (!res.ok) await parse(res);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
