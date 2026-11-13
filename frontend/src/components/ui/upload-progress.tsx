'use client';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { subscribeToUploads, UploadState } from '@/lib/upload-progress';

const SHOW_DELAY = 300; // a small file that is gone in a blink never flashes the bar
const fmt = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** One progress bar for every upload of the site (public forms and the admin): percent, size, and "processing" while the server finishes. */
export function UploadProgress() {
  const { t } = useI18n();
  const [s, setS] = useState<UploadState>({ active: 0, loaded: 0, total: 0 });
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => subscribeToUploads(setS), []);
  useEffect(() => {
    if (s.active > 0) { if (!shown && !timer.current) timer.current = setTimeout(() => { timer.current = undefined; setShown(true); }, SHOW_DELAY); }
    else { if (timer.current) { clearTimeout(timer.current); timer.current = undefined; } setShown(false); }
  }, [s.active, shown]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!shown || s.active === 0) return null;
  const pct = Math.min(100, Math.round((s.loaded / s.total) * 100));
  const sent = pct >= 100; // everything has left the browser: the server is saving and processing it
  return (
    <div className="fixed inset-x-0 bottom-4 z-[320] flex justify-center px-4 pointer-events-none" role="status" aria-live="polite">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-lift ring-1 ring-line">
        <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold text-secondary">
          <span>{sent ? t('up.processing') : t('up.uploading')}</span>
          <span dir="ltr" className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-primary/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className={`h-full rounded-full bg-primary transition-[width] duration-200 ${sent ? 'animate-pulse' : ''}`} style={{ width: `${pct}%` }} />
        </div>
        <div dir="ltr" className="mt-1.5 text-xs text-gray-500">{fmt(s.loaded)} / {fmt(s.total)}{s.active > 1 ? ` · ${s.active}` : ''}</div>
      </div>
    </div>
  );
}
