export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').replace(/\/$/, '');

/** Backend returns file URLs like /api/files/news/x.jpg – rebase them on the configured API URL. */
export function fileUrl(p?: string | null): string {
  if (!p) return '';
  if (/^https?:\/\//.test(p)) return p;
  return API_URL + p.replace(/^\/api/, '');
}

/** Fired after any successful change made through /admin/*: the site shell (settings, categories) reloads itself. */
export const SITE_CHANGED = 'site-data-changed';
const SITE_CHANNEL = 'site-data';
function announceSiteChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SITE_CHANGED));
  try { // other tabs of the same browser (e.g. the public site open next to the admin)
    const bc = new BroadcastChannel(SITE_CHANNEL);
    bc.postMessage('changed');
    bc.close();
  } catch { /* old browsers: the tab refreshes when it regains focus */ }
}
export function onSiteChange(cb: () => void) {
  window.addEventListener(SITE_CHANGED, cb);
  let bc: BroadcastChannel | null = null;
  try { bc = new BroadcastChannel(SITE_CHANNEL); bc.onmessage = cb; } catch { /* unsupported */ }
  return () => { window.removeEventListener(SITE_CHANGED, cb); bc?.close(); };
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Q = Record<string, string | number | boolean | null | undefined>;

let activeApiRequests = 0;
const apiRequestListeners = new Set<(active: number) => void>();

function updateActiveApiRequests(change: number) {
  activeApiRequests = Math.max(0, activeApiRequests + change);
  apiRequestListeners.forEach((listener) => listener(activeApiRequests));
}

export function getActiveApiRequests() {
  return activeApiRequests;
}

export function subscribeToApiRequests(listener: (active: number) => void) {
  apiRequestListeners.add(listener);
  return () => {
    apiRequestListeners.delete(listener);
  };
}

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

export async function api<T = any>(path: string, opts: { method?: string; params?: Q; body?: any; form?: FormData; cache?: RequestCache } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  updateActiveApiRequests(1);
  try {
    const res = await fetch(API_URL + path + qs(opts.params), { method: opts.method ?? 'GET', headers, body, credentials: 'include', cache: opts.cache ?? 'no-store' }); // never serve a stale list after an add / edit
    const out = await parse(res);
    if ((opts.method ?? 'GET') !== 'GET' && path.startsWith('/admin/')) announceSiteChange();
    return out;
  } finally {
    updateActiveApiRequests(-1);
  }
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
