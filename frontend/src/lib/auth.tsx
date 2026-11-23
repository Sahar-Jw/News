'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_URL, ApiError, SESSION_EXPIRED_EVENT, api, currentLang, sessionHint } from './api';

export interface Me {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  gender: 'male' | 'female' | null;
  country: string | null;
  city: { id: number; nameAr: string; nameEn: string } | null;
  nationality: string | null;
  role: { id: number; code: string; nameAr: string; nameEn: string } | null;
  avatarUrl: string | null;
  hasCv: boolean;
  bio: string | null;
  socialLink: string | null;
  isExpert: boolean;
  isResearcher: boolean;
  permissions: string[];
}

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  can: (...codes: string[]) => boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await api<Me>('/auth/me'));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // remember (as a plain flag) that this browser has a sign-in, so an expired short cookie is renewed silently instead of showing "login required"
  useEffect(() => { if (me) sessionHint.set(); }, [me]);

  // The sign-in cookie lasts a few hours. A tab left open past that still looks signed in, so the first call that needs the account fails with
  // 401 ("login required"). Re-check the session then (and when the tab comes back into view): if it is really over, `me` becomes null and the
  // management pages send the user to the login page, which brings them back here afterwards.
  useEffect(() => {
    let last = 0;
    const revalidate = async () => {
      last = Date.now();
      try { setMe(await api<Me>('/auth/me')); } catch (e) { if (e instanceof ApiError && e.status === 401) setMe(null); /* a network error is not a sign-out */ }
    };
    const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - last > 60_000) revalidate(); };
    window.addEventListener(SESSION_EXPIRED_EVENT, revalidate);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener(SESSION_EXPIRED_EVENT, revalidate); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api<{ user: Me }>('/auth/login', { method: 'POST', body: { email, password } });
    // The password was right, but is the sign-in cookie really kept and sent back? Check at once, instead of showing a signed-in page that
    // cannot do anything. Two things keep this from raising a false alarm:
    //  - one more try after a moment (a slow connection / a proxy that is still handling the Set-Cookie answer), and
    //  - only the server's "no sign-in cookie arrived" answer means a cookie problem: any other 401 (account switched off, password just
    //    reset ...) is shown with the server's own words, and the cause that is really measurable here (site and API on different domains) is named.
    const ar = currentLang() === 'ar';
    let failure: ApiError | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await api<Me>('/auth/me'); failure = null; break; } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) break; // a network error is not a cookie problem
        failure = e;
        if (attempt < 2) await new Promise((ok) => setTimeout(ok, 400 * (attempt + 1)));
      }
    }
    if (failure) {
      setMe(null);
      const noCookie = failure.message === 'يلزم تسجيل الدخول' || failure.message === 'You need to sign in';
      if (!noCookie) throw failure;
      let apiHost = '';
      try { apiHost = new URL(API_URL).hostname; } catch { /* relative API address: same site by definition */ }
      const site = window.location.hostname;
      const base = (h: string) => h.split('.').slice(-2).join('.');
      const crossSite = !!apiHost && base(apiHost) !== base(site);
      // eslint-disable-next-line no-console
      console.warn('[login] password accepted but /auth/me answered 401 without a cookie', { site, api: apiHost || '(same origin)', crossSite, https: window.location.protocol === 'https:' });
      throw new ApiError(401, crossSite
        ? (ar ? `الموقع (${site}) والخادم (${apiHost}) على نطاقين مختلفين، فيرفض المتصفح الكوكيز. استخدم نطاقاً فرعياً من نفس النطاق للطرفين، أو اضبط COOKIE_SAMESITE=none مع COOKIE_SECURE=true.` : `The site (${site}) and the API (${apiHost}) are on different domains, so the browser refuses the cookie. Put both on subdomains of the same domain, or set COOKIE_SAMESITE=none with COOKIE_SECURE=true.`)
        : (ar ? 'تم التحقق من كلمة المرور لكن المتصفح لم يحتفظ بجلسة الدخول. أعد المحاولة؛ وإن تكرر فاسمح بملفات تعريف الارتباط (cookies) لهذا الموقع وافتح الموقع من المتصفح مباشرة وليس من داخل تطبيق (واتساب/فيسبوك).' : 'Your password was accepted but the browser did not keep the sign-in session. Try again; if it repeats, allow cookies for this site and open it in the browser itself, not inside an app (WhatsApp / Facebook).'));
    }
    setMe(r.user);
    return r.user;
  };
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      sessionHint.clear();
      setMe(null);
    }
  };
  /** UI hint only – the server enforces every permission. */
  const can = (...codes: string[]) => !!me && codes.some((c) => me.permissions.includes(c));

  return <Ctx.Provider value={{ me, loading, can, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
