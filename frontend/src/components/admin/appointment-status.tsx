'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export interface Status { code: string; ar: string; en: string; color?: string }

const FALLBACK = '#6b7280';
/** "#abc" -> "#aabbcc", so a transparent background can be made by adding two hex digits. */
const full = (c?: string) => (c && /^#[0-9a-fA-F]{3}$/.test(c) ? `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}` : c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : FALLBACK);

/** The date statuses typed in Settings (appointments → statuses), with label and colour lookups. */
export function useStatuses() {
  const { lang } = useI18n();
  const [list, setList] = useState<Status[]>([]);
  useEffect(() => { api<Status[]>('/admin/appointments/statuses').then(setList).catch(() => {}); }, []);
  const find = (code: string) => list.find((s) => s.code === code);
  return {
    list,
    label: (code: string) => { const s = find(code); return s ? (lang === 'ar' ? s.ar : s.en) : code; },
    color: (code: string) => full(find(code)?.color),
  };
}

export function StatusBadge({ code, label, color }: { code: string; label: string; color: string }) {
  return <span key={code} className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color, backgroundColor: `${color}1f` }}>{label}</span>;
}
