/**
 * Opening hours of the One-Stop window, kept in one JSON setting (one_stop.schedule):
 *  - week: the 7 days (0 = Sunday ... 6 = Saturday), each open or closed with its own reception hours;
 *  - holidays: date ranges on which the window is closed (with a name);
 *  - changes: temporary modifications for a date range (closed, or different hours) with a note.
 * Dates are YYYY-MM-DD, hours HH:MM (24h).
 */
export interface DaySlot { day: number; open: boolean; from: string; to: string }
export interface Holiday { from: string; to: string; labelAr: string; labelEn: string }
export interface TempChange { from: string; to: string; closed: boolean; hoursFrom: string; hoursTo: string; noteAr: string; noteEn: string }
export interface Schedule { week: DaySlot[]; holidays: Holiday[]; changes: TempChange[] }

export const defaultSchedule = (): Schedule => ({
  week: Array.from({ length: 7 }, (_, day) => ({ day, open: day >= 0 && day <= 4, from: '08:00', to: '14:00' })),
  holidays: [],
  changes: [],
});

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const date = (v: unknown) => (typeof v === 'string' && DATE.test(v) ? v : '');
const time = (v: unknown, d: string) => (typeof v === 'string' && TIME.test(v) ? v : d);

/** Reads whatever came from the settings API; returns null when there is nothing usable (the page then falls back to the plain-text settings). */
export function readSchedule(raw: unknown): Schedule | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const base = defaultSchedule();
  const week = base.week.map((d) => {
    const hit = Array.isArray(o.week) ? (o.week as Record<string, unknown>[]).find((x) => x && Number(x.day) === d.day) : undefined;
    return hit ? { day: d.day, open: hit.open === true, from: time(hit.from, d.from), to: time(hit.to, d.to) } : d;
  });
  const holidays = (Array.isArray(o.holidays) ? (o.holidays as Record<string, unknown>[]) : []).filter((h) => h && date(h.from)).map((h) => ({ from: date(h.from), to: date(h.to) || date(h.from), labelAr: str(h.labelAr), labelEn: str(h.labelEn) }));
  const changes = (Array.isArray(o.changes) ? (o.changes as Record<string, unknown>[]) : []).filter((c) => c && date(c.from)).map((c) => ({ from: date(c.from), to: date(c.to) || date(c.from), closed: c.closed === true, hoursFrom: time(c.hoursFrom, '08:00'), hoursTo: time(c.hoursTo, '14:00'), noteAr: str(c.noteAr), noteEn: str(c.noteEn) }));
  return { week, holidays, changes };
}

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const within = (day: string, from: string, to: string) => day >= from && day <= (to || from);

export interface DayInfo { open: boolean; from: string; to: string; note: string; kind: 'week' | 'holiday' | 'change' }

/** What applies on one date: a holiday wins over a temporary change, which wins over the weekly hours. */
export function dayInfo(sc: Schedule, date: Date, lang: string): DayInfo {
  const key = ymd(date);
  const pick = (ar: string, en: string) => (lang === 'en' ? en || ar : ar || en);
  const h = sc.holidays.find((x) => within(key, x.from, x.to));
  if (h) return { open: false, from: '', to: '', note: pick(h.labelAr, h.labelEn), kind: 'holiday' };
  const c = sc.changes.find((x) => within(key, x.from, x.to));
  if (c) return { open: !c.closed, from: c.hoursFrom, to: c.hoursTo, note: pick(c.noteAr, c.noteEn), kind: 'change' };
  const w = sc.week.find((x) => x.day === date.getDay()) ?? sc.week[0];
  return { open: w.open, from: w.from, to: w.to, note: '', kind: 'week' };
}

/** "08:00" → "8:00 am" in the visitor's language (Arabic: ص / م). */
export function fmtTime(hhmm: string, lang: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString(lang === 'ar' ? 'ar-SY' : 'en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
}
export const dayName = (day: number, lang: string) => new Date(2024, 0, 7 + day).toLocaleDateString(lang === 'ar' ? 'ar-SY' : 'en-GB', { weekday: 'long' });
export const fmtDay = (iso: string, lang: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(lang === 'ar' ? 'ar-SY' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
