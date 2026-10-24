/** Calendar dates travel as plain "YYYY-MM-DD" strings (no time zone shifting). */
export function isYmd(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; // rejects 2026-02-30
}

export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}
