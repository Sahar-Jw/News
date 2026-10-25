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

/**
 * Each status is stored as three ordinary Settings rows (category "appointments"), edited like any other setting:
 *   status_<code>_ar     Arabic name   (text)
 *   status_<code>_en     English name  (text)
 *   status_<code>_color  badge colour  (color)
 * The order of the rows is the order of the statuses in the Dates form.
 */
export const STATUS_KEY = /^status_([A-Za-z0-9_-]{1,50})_(ar|en|color)$/;

export const statusKey = (code: string, part: 'ar' | 'en' | 'color') => `status_${code}_${part}`;

/** [key, value type, value] of the settings that describe the given statuses. */
export function statusSettingRows(list: AppointmentStatus[]): [string, 'text' | 'color', string | null][] {
  return list.flatMap((s) => [
    [statusKey(s.code, 'ar'), 'text', s.ar],
    [statusKey(s.code, 'en'), 'text', s.en],
    [statusKey(s.code, 'color'), 'color', s.color ?? null],
  ] as [string, 'text' | 'color', string | null][]);
}

/**
 * Builds the status list from the rows of the "appointments" settings category (in row order).
 * Falls back to the old single JSON row (key "statuses") until the migration has converted it.
 */
export function statusesFromSettings(rows: { key: string; value: string | null }[]): AppointmentStatus[] {
  const byCode = new Map<string, { code: string; ar?: string; en?: string; color?: string }>();
  for (const r of rows) {
    const m = STATUS_KEY.exec(r.key);
    if (!m) continue;
    const entry = byCode.get(m[1]) ?? { code: m[1] };
    (entry as any)[m[2]] = r.value ?? '';
    byCode.set(m[1], entry);
  }
  if (byCode.size) return normalizeStatuses([...byCode.values()]);
  const legacy = rows.find((r) => r.key === 'statuses');
  if (legacy?.value) {
    try {
      return normalizeStatuses(JSON.parse(legacy.value));
    } catch {
      /* fall through to the defaults */
    }
  }
  return DEFAULT_APPOINTMENT_STATUSES;
}
