'use client';
import { useI18n } from '@/lib/i18n';
import { fmtDay } from '@/lib/utils';
import { SocialIcon } from '@/components/site/icons';
import { ApplyForm, Block, Heading, useExpoInfo } from '@/components/site/expo-shared';

const SOCIAL = ['facebook_url', 'x_url', 'instagram_url', 'linkedin_url', 'youtube_url', 'whatsapp_url', 'telegram_url'] as const;

/** EXPO contact: details, the team (one member per line "name | role | phone | e-mail" in Settings), social media and an information request. */
export default function ExpoContact() {
  const { lang, t } = useI18n();
  const ar = lang === 'ar';
  const x = useExpoInfo();
  const team = x.lines('team').map((line) => { const [name, role, phone, email] = line.split('|').map((p) => p.trim()); return { name, role, phone, email }; }).filter((m) => m.name);
  const socials = SOCIAL.filter((k) => x.social(k));
  const card = 'rounded-2xl bg-white p-4 shadow-card ring-1 ring-line';
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Heading>{t('ex.contact')}</Heading>
      <div className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
        {x.start && <div className={card}>📅 {fmtDay(lang, x.start)}{x.end && x.end !== x.start ? ` — ${fmtDay(lang, x.end)}` : ''}</div>}
        {x.venue && <div className={card}>📍 {x.venue}</div>}
        {x.address && <div className={card}>🏢 {x.address}{x.mapUrl && <> · <a href={x.mapUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">{ar ? 'الموقع على الخريطة' : 'Map'} ↗</a></>}</div>}
        {x.phone && <a href={`tel:${x.phone.replace(/[^+\d]/g, '')}`} className={card}>☎ <bdi dir="ltr">{x.phone}</bdi></a>}
        {x.email && <a href={`mailto:${x.email}`} className={card}>✉ <bdi dir="ltr">{x.email}</bdi></a>}
        {x.website && <a href={x.website} target="_blank" rel="noopener noreferrer" className={card}>🌐 {ar ? 'الموقع الإلكتروني' : 'Website'} ↗</a>}
      </div>
      {socials.length > 0 && <div className="mb-6 flex flex-wrap items-center justify-center gap-2">{socials.map((k) => <a key={k} href={x.social(k)} target="_blank" rel="noopener noreferrer" aria-label={k.replace('_url', '')} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white transition hover:brightness-110"><SocialIcon name={k} size={18} /></a>)}</div>}
      {team.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 text-lg font-extrabold text-primary">{ar ? 'فريق المعرض' : 'The expo team'}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {team.map((m, i) => (
              <article key={i} className={`${card} flex items-center gap-3`}>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-lg font-extrabold text-primary">{m.name.slice(0, 1)}</span>
                <div className="min-w-0 text-sm">
                  <div className="font-extrabold text-secondary">{m.name}</div>
                  {m.role && <div className="text-xs text-gray-600">{m.role}</div>}
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                    {m.phone && <a href={`tel:${m.phone.replace(/[^+\d]/g, '')}`} dir="ltr" className="text-primary hover:underline">{m.phone}</a>}
                    {m.email && <a href={`mailto:${m.email}`} dir="ltr" className="text-primary hover:underline">{m.email}</a>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <Block title={t('ex.kind.info')}><ApplyForm kind="info" sectors={[]} /></Block>
    </div>
  );
}
