export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function fmtDate(lang: string, iso?: string | null, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
}
/** A calendar date (YYYY-MM-DD) shown as written, in every time zone (never shifted to the viewer's local day). */
export function fmtDay(lang: string, ymd?: string | null) {
  if (!ymd) return '';
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d);
}
export const fmtNum = (lang: string, n: number) => new Intl.NumberFormat(lang === 'ar' ? 'ar' : 'en-US').format(n);

/** ISO -> value for <input type="datetime-local"> in local time */
export function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const SECTIONS = ['BREAKING', 'SERVICES', 'TEAM', 'TESTIMONIALS', 'PARTNERS', 'EXPERTS', 'STATISTICS', 'COMPANY_OVERVIEW'] as const;
export type SectionCode = (typeof SECTIONS)[number];
export const LANGS = ['ar', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export function shareLinks(url: string, title: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    whatsapp: `https://wa.me/?text=${t}%0A${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    // Gmail's compose window (opens in a new tab) instead of the system mail app
    email: `https://mail.google.com/mail/?view=cm&fs=1&su=${t}&body=${u}`,
  };
}

export type NewsAction = 'read' | 'create' | 'update' | 'delete';
/** CRUD permission of a content kind: `news.<action>.<section>`; regular news (no section) is `news.<action>`. */
export const newsPerm = (action: NewsAction, section?: string) => {
  const sec = section && section.toLowerCase() !== 'regular' ? section.toLowerCase() : '';
  return sec ? `news.${action}.${sec}` : `news.${action}`;
};
/** Every permission of one action (regular + all sections): "can do this action on *something*". */
export const anyNewsPerm = (action: NewsAction) => [newsPerm(action), ...SECTIONS.map((s) => newsPerm(action, s))];
export const createPermFor = (section?: string) => newsPerm('create', section);

/** `tel:` link for a phone / mobile number typed in Settings (spaces and dashes are dropped). */
export const telHref = (n: string) => `tel:${n.replace(/[\s\-().]/g, '')}`;
/** https://www.example.com/ -> www.example.com (for showing a website link as text). */
export const prettyUrl = (u: string) => u.replace(/^https?:\/\//i, '').replace(/\/$/, '');
