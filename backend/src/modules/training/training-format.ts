/** Course duration and time-of-day texts shared by the e-mails (the site has its own copy in components/site/training-shared.ts). */
type Lang = 'ar' | 'en';

/** "3 h 30 min" / "3 ساعات و30 دقيقة" */
export function durationText(hours: number | null | undefined, minutes: number | null | undefined, lang: Lang): string {
  const h = hours ?? 0, m = minutes ?? 0;
  if (h <= 0 && m <= 0) return '';
  if (lang === 'en') return [h > 0 ? `${h} h` : '', m > 0 ? `${m} min` : ''].filter(Boolean).join(' ');
  const hp = h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : h >= 3 && h <= 10 ? `${h} ساعات` : `${h} ساعة`;
  const mp = m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتان' : m >= 3 && m <= 10 ? `${m} دقائق` : `${m} دقيقة`;
  return [h > 0 ? hp : '', m > 0 ? mp : ''].filter(Boolean).join(' و');
}

/** "15:30" -> "3:30 PM" / "3:30 م" (12-hour clock with AM / PM) */
export function time12(hhmm: string | null | undefined, lang: Lang): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return '';
  const h = Number(m[1]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${h < 12 ? (lang === 'ar' ? 'ص' : 'AM') : lang === 'ar' ? 'م' : 'PM'}`;
}

/** "3:30 PM – 6:00 PM" */
export function timeRange(start: string | null | undefined, end: string | null | undefined, lang: Lang): string {
  const a = time12(start, lang), b = time12(end, lang);
  return a && b ? `${a} – ${b}` : a || b;
}
