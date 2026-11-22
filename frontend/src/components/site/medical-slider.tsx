'use client';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { telHref } from '@/lib/utils';
import { SocialIcon, ContactIcon } from './icons';
import { useSite } from './site-context';

export interface MedicalEntry {
  id: string; active?: boolean;
  specialtyAr?: string; specialtyEn?: string; nameAr?: string; nameEn?: string;
  scheduleAr?: string; scheduleEn?: string; notesAr?: string; notesEn?: string;
}

const lines = (v: unknown) => String(v ?? '').split('\n').map((x) => x.trim()).filter(Boolean);

/**
 * Home slider of the medical center. Slide 1: logo, name, winter / summer hours, phone numbers and the Facebook page.
 * The next slides list the doctors / departments with their days and times (a few per slide, grouped as in Settings).
 * Everything comes from Settings (category `medical`); the section is shown / hidden with sections_home -> medical_visible.
 */
export function MedicalSlider() {
  const { s, loc, img } = useSite();
  const { lang, t } = useI18n();
  const ar = lang === 'ar';
  const pick = (a?: string | null, e?: string | null) => (ar ? a || e : e || a) || '';

  const name = loc('medical', 'name') || String(s('medical', 'name_ar') ?? '');
  const about = loc('medical', 'about');
  const logo = img('medical', 'logo');
  const winter = loc('medical', 'hours_winter');
  const summer = loc('medical', 'hours_summer');
  const phones = lines(s('medical', 'phones'));
  const fb = String(s('medical', 'facebook_url') ?? '').trim();
  const autoplay = s('medical', 'autoplay') !== false;
  const seconds = Math.min(60, Math.max(3, Number(s('medical', 'interval_seconds')) || 8));
  const perSlide = Math.min(12, Math.max(1, Math.round(Number(s('medical', 'doctors_per_slide')) || 6)));
  const showDoctors = s('medical', 'show_doctors') !== false;
  const raw = s('medical', 'doctors');
  const entries: MedicalEntry[] = useMemo(() => (Array.isArray(raw) ? raw.filter((d: MedicalEntry) => d && d.active !== false) : []), [raw]);

  const hasInfo = !!(name || logo || winter || summer || phones.length || fb);
  const pages = useMemo(() => {
    if (!showDoctors) return [] as MedicalEntry[][];
    const out: MedicalEntry[][] = [];
    for (let k = 0; k < entries.length; k += perSlide) out.push(entries.slice(k, k + perSlide));
    return out;
  }, [entries, perSlide, showDoctors]);

  const count = (hasInfo ? 1 : 0) + pages.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!autoplay || paused || count < 2) return;
    const timer = window.setTimeout(() => setI((c) => (c + 1) % count), seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [i, autoplay, paused, count, seconds]);
  if (!count) return null;
  const cur = Math.min(i, count - 1);
  const go = (d: number) => setI((c) => (Math.min(c, count - 1) + d + count) % count);

  const arrow = (side: 'prev' | 'next') => (
    <button type="button" onClick={() => go(side === 'prev' ? -1 : 1)} aria-label={side === 'prev' ? t('med.prev') : t('med.next')}
      className={`absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-secondary/60 text-white ring-1 ring-accent/50 transition hover:bg-secondary/85 md:flex ${side === 'prev' ? 'left-2' : 'right-2'}`}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={side === 'prev' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} /></svg>
    </button>
  );

  const slides: React.ReactNode[] = [];
  if (hasInfo) slides.push(
    <div className="grid items-center gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-3 text-center">
        {logo && <img src={logo} alt={name} className="max-h-36 w-auto max-w-full object-contain" />}
        {name && <h3 className="text-xl font-extrabold text-secondary md:text-2xl">{name}</h3>}
        {about && <p className="text-sm leading-7 text-[color:var(--muted)]">{about}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(winter || summer) && (
          <div className="rounded-2xl bg-primary/[0.06] p-4 ring-1 ring-line sm:col-span-2">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-primary"><ContactIcon name="hours" size={16} />{t('med.hours')}</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {winter && <p className="text-sm leading-7"><span className="me-2 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-bold text-secondary">{t('med.winter')}</span>{winter}</p>}
              {summer && <p className="text-sm leading-7"><span className="me-2 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-bold text-secondary">{t('med.summer')}</span>{summer}</p>}
            </div>
          </div>
        )}
        {phones.length > 0 && (
          <div className="rounded-2xl bg-primary/[0.06] p-4 ring-1 ring-line">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-primary"><ContactIcon name="phone" size={16} />{t('med.phones')}</h4>
            <ul className="space-y-1">
              {phones.map((p) => <li key={p}><a href={telHref(p)} dir="ltr" className="inline-block text-sm font-semibold hover:text-primary hover:underline">{p}</a></li>)}
            </ul>
          </div>
        )}
        {fb && (
          <div className="flex items-center rounded-2xl bg-primary/[0.06] p-4 ring-1 ring-line">
            <a href={fb} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-white shadow-lift transition hover:-translate-y-px hover:brightness-110">
              <SocialIcon name="facebook_url" size={16} />{t('med.facebook')}
            </a>
          </div>
        )}
      </div>
    </div>,
  );
  pages.forEach((list, n) => slides.push(
    <div>
      <h4 className="mb-3 text-center text-sm font-bold text-primary">{t('med.doctors')} <span className="text-gray-400">({n + 1}/{pages.length})</span></h4>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {list.map((d) => {
          const sp = pick(d.specialtyAr, d.specialtyEn);
          const nm = pick(d.nameAr, d.nameEn);
          const sched = lines(pick(d.scheduleAr, d.scheduleEn));
          const note = pick(d.notesAr, d.notesEn);
          return (
            <article key={d.id} className="rounded-2xl bg-white p-3.5 shadow-card ring-1 ring-line">
              {nm && sp && <span className="inline-block rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-bold text-secondary">{sp}</span>}
              <h5 className="mt-1.5 text-base font-extrabold text-secondary">{nm || sp}</h5>
              <ul className="mt-2 space-y-1.5">
                {sched.map((ln, k) => {
                  const [days, time] = ln.includes('|') ? ln.split('|').map((x) => x.trim()) : [ln, ''];
                  return <li key={k} className="text-xs leading-6 text-[color:var(--muted)]"><span>{days}</span>{time && <span className="ms-2 inline-block rounded bg-primary/10 px-1.5 font-semibold text-primary" dir="ltr">{time}</span>}</li>;
                })}
              </ul>
              {note && <p className="mt-2 border-t border-line pt-1.5 text-xs font-semibold text-gray-600">{note}</p>}
            </article>
          );
        })}
      </div>
    </div>,
  ));

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} aria-roledescription="carousel" aria-label={name || t('sec.medical')}>
      <div className="relative overflow-hidden rounded-3xl bg-white/70 p-4 shadow-card ring-1 ring-line md:px-14 md:py-6">
        {/* every slide sits in the same grid cell, so the box keeps the height of the tallest one and nothing jumps */}
        <div className="grid">
          {slides.map((sl, k) => (
            <div key={k} aria-hidden={k !== cur} {...(k !== cur ? { inert: true } : {})} className={`col-start-1 row-start-1 transition-opacity duration-500 ${k === cur ? 'opacity-100' : 'invisible opacity-0'}`}>{sl}</div>
          ))}
        </div>
        {count > 1 && <>{arrow('prev')}{arrow('next')}</>}
      </div>
      {count > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5" role="tablist">
          {slides.map((_, k) => (
            <button key={k} type="button" role="tab" aria-selected={k === cur} aria-label={`slide ${k + 1}`} onClick={() => setI(k)} className="py-2">
              <span className={`block h-2 rounded-full transition-all ${k === cur ? 'w-6 bg-accent' : 'w-2 bg-primary/30 hover:bg-primary/60'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
