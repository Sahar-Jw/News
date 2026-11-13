/** Backend URL, read at RUNTIME: in the browser from /runtime-config.js (window.__ENV), on the server from process.env.API_URL. */
const RAW_API_URL =
  (typeof window !== 'undefined' ? (window as unknown as { __ENV?: { API_URL?: string } }).__ENV?.API_URL : undefined) ??
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api';
// a stray space or a doubled value in the environment variable ("https://x/api   https://x/api") must not break every file link: use the first address
export const API_URL = (RAW_API_URL.match(/https?:\/\/\S+/)?.[0] ?? RAW_API_URL.trim()).replace(/\/$/, '');

/** Backend returns file URLs like /api/files/news/x.jpg – rebase them on the configured API URL. */
export function fileUrl(p?: string | null): string {
  if (!p) return '';
  p = p.trim();
  // an address that got another address glued in front of it (separated by spaces): keep the last, complete one
  if (/\s/.test(p)) { const all = p.match(/https?:\/\/\S+/g); if (all) return all[all.length - 1]; }
  if (/^https?:\/\//.test(p)) return p;
  return API_URL + p.replace(/^\/api/, '');
}

import { endUpload, startUpload, updateUpload } from './upload-progress';

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

/** Language of the page the request comes from (/ar/... or /en/...); the API answers its messages in it. */
export function currentLang(): 'ar' | 'en' {
  if (typeof window === 'undefined') return 'ar';
  const m = /^\/(ar|en)(\/|$)/.exec(window.location.pathname);
  return m ? (m[1] as 'ar' | 'en') : document.documentElement.lang === 'en' ? 'en' : 'ar';
}

/** Fired when a call that needs the signed-in account is refused with 401 (the session cookie ran out): the auth context re-checks the session. */
export const SESSION_EXPIRED_EVENT = 'auth:expired';

/**
 * "Was someone signed in on this browser?" (a flag only, no secret). The sign-in cookie itself is HttpOnly, so the page cannot see it; this flag
 * lets the page try a silent renewal only for people who were signed in, and not for every anonymous visitor.
 */
const SESSION_HINT = 'dcc_session';
export const sessionHint = {
  set() { try { localStorage.setItem(SESSION_HINT, '1'); } catch { /* storage blocked */ } },
  clear() { try { localStorage.removeItem(SESSION_HINT); } catch { /* storage blocked */ } },
  has() { try { return localStorage.getItem(SESSION_HINT) === '1'; } catch { return false; } },
};

let renewing: Promise<boolean> | null = null;
/** Asks the server for a fresh short sign-in cookie using the refresh cookie. Calls made at the same moment share one request. */
function renewSession(): Promise<boolean> {
  if (!renewing) {
    renewing = fetch(API_URL + '/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'X-Lang': currentLang() } })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { renewing = null; });
  }
  return renewing;
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
    // not a JSON answer from the API: the web server / proxy in front of it refused the request (e.g. 413 = file too big for the server)
    const fromProxy = typeof data === 'string' || data === null;
    const generic = res.status === 413 ? (currentLang() === 'ar' ? 'حجم الملف أكبر مما يسمح به الخادم' : 'The file is larger than the server allows')
      : fromProxy && res.status >= 500 ? (currentLang() === 'ar' ? 'تعذّر الوصول إلى الخادم، حاول لاحقاً' : 'The server could not be reached, try again later')
      : '';
    throw new ApiError(res.status, Array.isArray(m) ? m.join(' • ') : (fromProxy && generic) || m || res.statusText || 'Error');
  }
  return data;
}

/** The bytes of the files inside a form (0 = nothing to upload, a plain form). */
function filesSize(form: FormData): number {
  let n = 0;
  form.forEach((v) => { if (typeof v !== 'string') n += (v as File).size; });
  return n;
}

/** fetch() cannot report how much of a request body was sent, so a form with files goes through XMLHttpRequest, which can. The answer is the same Response. */
function sendWithProgress(url: string, init: { method: string; headers: Record<string, string>; body: FormData }, bytes: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const id = startUpload(bytes);
    const xhr = new XMLHttpRequest();
    xhr.open(init.method, url);
    xhr.withCredentials = true;
    for (const [k, v] of Object.entries(init.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) updateUpload(id, (e.loaded / e.total) * bytes); };
    xhr.onload = () => { endUpload(id); resolve(new Response(xhr.status === 204 || xhr.status === 205 ? null : xhr.responseText, { status: xhr.status || 200, statusText: xhr.statusText })); };
    xhr.onerror = () => { endUpload(id); reject(new TypeError('network')); };
    xhr.onabort = () => { endUpload(id); reject(new TypeError('aborted')); };
    xhr.send(init.body);
  });
}

export async function api<T = any>(path: string, opts: { method?: string; params?: Q; body?: any; form?: FormData; cache?: RequestCache; _retried?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Lang': currentLang() };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  updateActiveApiRequests(1);
  try {
    const url = API_URL + path + qs(opts.params);
    const bytes = opts.form ? filesSize(opts.form) : 0;
    const res = bytes > 0 && typeof XMLHttpRequest !== 'undefined'
      ? await sendWithProgress(url, { method: opts.method ?? 'POST', headers, body: opts.form as FormData }, bytes)
      : await fetch(url, { method: opts.method ?? 'GET', headers, body, credentials: 'include', cache: opts.cache ?? 'no-store' }); // never serve a stale list after an add / edit
    const out = await parse(res);
    if ((opts.method ?? 'GET') !== 'GET' && path.startsWith('/admin/')) announceSiteChange();
    return out;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && typeof window !== 'undefined') {
      // the short sign-in cookie ran out: renew it silently from the refresh cookie and repeat this call once
      const own = /^\/auth\/(login|refresh|logout)/.test(path);
      if (!own && !opts._retried && sessionHint.has()) {
        if (await renewSession()) return api<T>(path, { ...opts, _retried: true });
        sessionHint.clear(); // the sign-in is really over
      }
      // /auth/* answers 401 by itself (wrong password, nobody signed in): only the other calls mean "your session ended"
      if (!path.startsWith('/auth/')) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    if (e instanceof TypeError) throw new ApiError(0, currentLang() === 'ar' ? 'تعذّر الاتصال بالخادم، تحقق من الاتصال أو من حجم الملف' : 'Could not reach the server - check the connection or the file size');
    throw e;
  } finally {
    updateActiveApiRequests(-1);
  }
}

/** Download an export (csv/xlsx) – sends the same filters as the table. */
export async function download(path: string, params: Q, fallbackName: string) {
  const res = await fetch(API_URL + path + qs(params), { credentials: 'include', headers: { 'X-Lang': currentLang() } });
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
