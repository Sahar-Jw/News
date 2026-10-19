export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function fmtDate(lang: string, iso?: string | null, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d);
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

/** Permission needed to create content of a section: `news.create.<section>`; regular news (no section) is `news.create`. */
export const createPermFor = (section?: string) => (section ? `news.create.${section.toLowerCase()}` : 'news.create');
