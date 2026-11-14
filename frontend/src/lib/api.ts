/** Backend URL, read at RUNTIME: in the browser from /runtime-config.js (window.__ENV), on the server from process.env.API_URL. */
const RAW_API_URL =
  (typeof window !== 'undefined' ? (window as unknown as { __ENV?: { API_URL?: string } }).__ENV?.API_URL : undefined) ??
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api';
// a stray space or a doubled value in the environment variable ("https://x/api   https://x/api") must not break every file link: use the first address
export const API_URL = (RAW_API_URL.match(/https?:\/\/\S+/)?.[0] ?? RAW_API_URL.trim()).replace(/\/$/, '');

/**
 * The same file address, asking the server to send it as a DOWNLOAD (Content-Disposition: attachment) with a readable file name.
 * The HTML `download` attribute is ignored by browsers when the file is on another domain than the page, so the file would just open.
 */
export function withDownload(url: string, name?: string): string {
  if (!url || !url.startsWith(API_URL)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}download=1${name ? `&name=${encodeURIComponent(name)}` : ''}`;
}
export const downloadUrl = (p?: string | null, name?: string) => withDownload(fileUrl(p), name);

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
    xhr.timeout = 10 * 60 * 1000; // a dead connection must not keep the sender waiting for ever
    xhr.ontimeout = () => { endUpload(id); reject(new TypeError('timeout')); };
    for (const [k, v] of Object.entries(init.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) updateUpload(id, (e.loaded / e.total) * bytes); };
    xhr.onload = () => { endUpload(id); resolve(new Response(xhr.status === 204 || xhr.status === 205 ? null : xhr.responseText, { status: xhr.status || 200, statusText: xhr.statusText })); };
    xhr.onerror = () => { endUpload(id); reject(new TypeError('network')); };
    xhr.onabort = () => { endUpload(id); reject(new TypeError('aborted')); };
    xhr.send(init.body);
  });
}

type ApiOpts = { method?: string; params?: Q; body?: any; form?: FormData; cache?: RequestCache; _retried?: boolean; _key?: string };

// ---------------------------------------------------------------------------------------------------------------------------
// Safe "add": one press of a button must never create two records, even on a slow or dropped connection.
//  - the same add (same address and same content) that is still on its way is not sent again: the second call gets the first one's answer;
//  - every add carries an Idempotency-Key. When the connection fails and nobody knows whether the server got the request, pressing the
//    button again reuses the SAME key for a few minutes, and the server (which remembers the answer) does not run it a second time;
//  - while any change is being saved, every submit button of the page is switched off (see globals.css, html[data-saving]).
// ---------------------------------------------------------------------------------------------------------------------------
const inflight = new Map<string, Promise<unknown>>();
const pendingKeys = new Map<string, { key: string; at: number }>();
const KEY_TTL_MS = 5 * 60 * 1000;
let saving = 0;

function setSaving(change: number) {
  saving = Math.max(0, saving + change);
  if (typeof document === 'undefined') return;
  if (saving > 0) document.documentElement.setAttribute('data-saving', '1');
  else document.documentElement.removeAttribute('data-saving');
}

function newKey(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  const raw = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return raw.replace(/[^A-Za-z0-9_-]/g, '');
}

/** What makes two calls "the same add": the address plus the content (for files: name, size and date, not the bytes). */
function signature(path: string, opts: ApiOpts): string {
  let content = '';
  if (opts.form) {
    const parts: string[] = [];
    opts.form.forEach((v, k) => parts.push(typeof v === 'string' ? `${k}=${v}` : `${k}=file:${(v as File).name}:${(v as File).size}:${(v as File).lastModified}`));
    content = parts.join('&');
  } else if (opts.body !== undefined) content = JSON.stringify(opts.body);
  return `${path}${qs(opts.params)}|${content}`;
}

export function api<T = any>(path: string, opts: ApiOpts = {}): Promise<T> {
  const method = (opts.method ?? 'GET').toUpperCase();
  if (method === 'GET') return request<T>(path, opts);
  const track = <R,>(p: Promise<R>): Promise<R> => { setSaving(1); return p.finally(() => setSaving(-1)); };
  // sign-in has its own rules (cookies), and the call repeated after a silent renewal is the same call, not a new one
  if (method !== 'POST' || opts._retried || path.startsWith('/auth/')) return track(request<T>(path, opts));

  const sig = signature(path, opts);
  const running = inflight.get(sig);
  if (running) return running as Promise<T>;
  const prev = pendingKeys.get(sig);
  const key = prev && Date.now() - prev.at < KEY_TTL_MS ? prev.key : newKey();
  pendingKeys.set(sig, { key, at: Date.now() });
  const p = track(request<T>(path, { ...opts, _key: key }))
    .then((v) => { pendingKeys.delete(sig); return v; }, (e) => {
      // the server answered (a validation error, a refusal): that attempt is over, the next one is new. No answer (status 0): keep the key.
      if (e instanceof ApiError && e.status !== 0) pendingKeys.delete(sig);
      throw e;
    })
    .finally(() => { inflight.delete(sig); });
  inflight.set(sig, p);
  return p;
}

async function request<T = any>(path: string, opts: ApiOpts = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Lang': currentLang() };
  if (opts._key) headers['Idempotency-Key'] = opts._key;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  updateActiveApiRequests(1);
  try {
    const url = API_URL + path + qs(opts.params);
    const bytes = opts.form ? filesSize(opts.form) : 0;
    // a connection that went silent ends after a while instead of leaving the button disabled for ever
    const ctrl = new AbortController();
    timer = setTimeout(() => ctrl.abort(), 90_000);
    const res = bytes > 0 && typeof XMLHttpRequest !== 'undefined'
      ? await sendWithProgress(url, { method: opts.method ?? 'POST', headers, body: opts.form as FormData }, bytes)
      : await fetch(url, { method: opts.method ?? 'GET', headers, body, credentials: 'include', cache: opts.cache ?? 'no-store', signal: ctrl.signal }); // never serve a stale list after an add / edit
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
    if (e instanceof TypeError || (e as { name?: string })?.name === 'AbortError') {
      const write = (opts.method ?? 'GET').toUpperCase() !== 'GET';
      const ar = currentLang() === 'ar';
      throw new ApiError(0, write
        ? (ar ? 'انقطع الاتصال أو كان بطيئاً ولم يصلنا تأكيد. تحقق من الإنترنت ثم أعد المحاولة، ولن يُسجَّل الطلب مرتين.' : 'The connection dropped or was too slow, so we got no confirmation. Check your internet and try again - it will not be saved twice.')
        : (ar ? 'تعذّر الاتصال بالخادم، تحقق من الاتصال أو من حجم الملف' : 'Could not reach the server - check the connection or the file size'));
    }
    throw e;
  } finally {
    clearTimeout(timer);
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
