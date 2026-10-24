export interface AppointmentStatus { code: string; ar: string; en: string; color?: string }

/** Used when the setting appointments.statuses is missing or has no valid entry. */
export const DEFAULT_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  { code: 'scheduled', ar: 'مجدول', en: 'Scheduled', color: '#2563eb' },
  { code: 'confirmed', ar: 'مؤكد', en: 'Confirmed', color: '#16a34a' },
  { code: 'completed', ar: 'مكتمل', en: 'Completed', color: '#6b7280' },
  { code: 'cancelled', ar: 'ملغي', en: 'Cancelled', color: '#dc2626' },
];

/** Keeps only well-formed entries of the JSON typed in Settings (a typo there must never break the Dates form). */
export function normalizeStatuses(raw: unknown): AppointmentStatus[] {
  if (!Array.isArray(raw)) return DEFAULT_APPOINTMENT_STATUSES;
  const seen = new Set<string>();
  const out: AppointmentStatus[] = [];
  for (const x of raw as any[]) {
    const code = typeof x?.code === 'string' ? x.code.trim() : '';
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(code) || seen.has(code)) continue;
    const ar = typeof x.ar === 'string' && x.ar.trim() ? x.ar.trim().slice(0, 60) : '';
    const en = typeof x.en === 'string' && x.en.trim() ? x.en.trim().slice(0, 60) : '';
    const color = typeof x.color === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(x.color) ? x.color : undefined;
    seen.add(code);
    out.push({ code, ar: ar || en || code, en: en || ar || code, ...(color && { color }) });
  }
  return out.length ? out : DEFAULT_APPOINTMENT_STATUSES;
}
