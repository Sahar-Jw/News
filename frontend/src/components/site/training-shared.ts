/** Shape of a public course (GET /public/training/courses) and shared helpers for the Training Center pages. */
export interface PublicCourse {
  id: number; kind: string; name: string; field: string; audience: string; topics: string[];
  trainer: { id: number; name: string; bio: string } | null;
  startDate: string; endDate: string | null; hours: number | null; location: string; fee: string;
  seatsLeft: number | null; status: 'open' | 'full' | 'closed' | 'ended'; imageUrl: string | null;
}
export const COURSE_KINDS = ['course', 'workshop', 'seminar', 'diploma'] as const;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+0-9()\-\s]{6,30}$/;

/** "12 March 2026" or "from 12 March 2026 to 14 March 2026" (the template comes from the dictionary) */
export function courseDates(course: Pick<PublicCourse, 'startDate' | 'endDate'>, fmt: (d: string) => string, range: string) {
  const a = fmt(course.startDate);
  if (!course.endDate || course.endDate === course.startDate) return a;
  return range.replace('{a}', a).replace('{b}', fmt(course.endDate));
}
