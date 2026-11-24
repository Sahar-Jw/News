import { fmtDay } from '@/lib/utils';

/** Shape of a public course (GET /public/training/courses) and shared helpers for the Training Center pages. */
export interface PublicCourse {
  id: number; kind: string; name: string; field: string; audience: string; topics: string[];
  trainer: { id: number; name: string; bio: string } | null;
  startDate: string; endDate: string | null; hours: number | null; minutes?: number | null; startTime?: string | null; endTime?: string | null; location: string; fee: string;
  seatsLeft: number | null; status: 'open' | 'full' | 'closed' | 'ended'; imageUrl: string | null;
}
export const COURSE_KINDS = ['course', 'workshop', 'seminar', 'diploma'] as const;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+0-9()\-\s]{6,30}$/;
/** three-part name: first, father, family (same rule as the API) */
export const THREE_PART_NAME_RE = /^\S+(\s+\S+){2,}$/;

/** "12 March 2026" or "from 12 March 2026 to 14 March 2026" (the template comes from the dictionary) */
export function courseDates(course: Pick<PublicCourse, 'startDate' | 'endDate'>, fmt: (d: string) => string, range: string) {
  const a = fmt(course.startDate);
  if (!course.endDate || course.endDate === course.startDate) return a;
  return range.replace('{a}', a).replace('{b}', fmt(course.endDate));
}

/** "3 h 30 min" / "3 ساعات و30 دقيقة" */
export function durationText(hours: number | null | undefined, minutes: number | null | undefined, lang: string): string {
  const h = hours ?? 0, m = minutes ?? 0;
  if (h <= 0 && m <= 0) return '';
  if (lang !== 'ar') return [h > 0 ? `${h} h` : '', m > 0 ? `${m} min` : ''].filter(Boolean).join(' ');
  const hp = h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : h >= 3 && h <= 10 ? `${h} ساعات` : `${h} ساعة`;
  const mp = m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتان' : m >= 3 && m <= 10 ? `${m} دقائق` : `${m} دقيقة`;
  return [h > 0 ? hp : '', m > 0 ? mp : ''].filter(Boolean).join(' و');
}

/** "15:30" -> "3:30 PM" / "3:30 م": always the 12-hour clock with AM / PM */
export function time12(hhmm: string | null | undefined, lang: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? (lang === 'ar' ? 'ص' : 'AM') : lang === 'ar' ? 'م' : 'PM'}`;
}

/** "3:30 PM – 6:00 PM" */
export function timeRange(start: string | null | undefined, end: string | null | undefined, lang: string): string {
  const a = time12(start, lang), b = time12(end, lang);
  return a && b ? `${a} – ${b}` : a || b;
}

export interface CourseFact { icon: string; label: string; value: string }

/** The facts of a course as label / value pairs with an icon name (components/site/pro-icon.tsx), empty ones left out. */
export function courseFacts(c: PublicCourse, t: (k: string) => string, lang: string, withMore = false): CourseFact[] {
  const list: CourseFact[] = [
    { icon: 'user', label: t('tr.trainer'), value: c.trainer?.name ?? '' },
    { icon: 'calendar', label: t('tr.date'), value: courseDates(c, (d) => fmtDay(lang, d), t('tr.fromTo')) },
    { icon: 'clock', label: t('tr.time'), value: timeRange(c.startTime, c.endTime, lang) },
    { icon: 'hourglass', label: t('tr.duration'), value: durationText(c.hours, c.minutes, lang) },
    { icon: 'pin', label: t('tr.place'), value: c.location },
    { icon: 'users', label: t('tr.audience'), value: c.audience },
    { icon: 'card', label: t('tr.fee'), value: c.fee },
  ];
  if (withMore) {
    list.splice(5, 0, { icon: 'compass', label: t('tr.field'), value: c.field });
    list.push({ icon: 'check', label: t('tr.seatsLeft'), value: c.seatsLeft != null && c.status !== 'ended' ? String(c.seatsLeft) : '' });
  }
  return list.filter((f) => f.value);
}
