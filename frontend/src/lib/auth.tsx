'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ApiError, SESSION_EXPIRED_EVENT, api, currentLang, sessionHint } from './api';

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
    // The password was right, but is the sign-in cookie really kept and sent back? (Browsers that block cross-site cookies, or a site and API on
    // different domains without COOKIE_SAMESITE=none, accept the login and then refuse every next call with "login required".) Check at once
    // and say so, instead of showing a signed-in page that cannot do anything.
    try { await api<Me>('/auth/me'); } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setMe(null);
        throw new ApiError(401, currentLang() === 'ar'
          ? 'تم التحقق من كلمة المرور لكن المتصفح لم يحتفظ بجلسة الدخول. اسمح بملفات تعريف الارتباط (cookies) لهذا الموقع، أو أخبر مدير الموقع أن إعدادات الكوكيز في الخادم (COOKIE_SAMESITE / COOKIE_SECURE) غير صحيحة.'
          : 'Your password was accepted but the browser did not keep the sign-in session. Allow cookies for this site, or tell the site administrator that the server cookie settings (COOKIE_SAMESITE / COOKIE_SECURE) are wrong.');
      }
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
