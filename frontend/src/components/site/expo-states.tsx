import Link from 'next/link';

/** Loading / 404 / error screens of the DCC EXPO site. Plain components (no providers) so loading.tsx, error.tsx, not-found.tsx and the global 404 can all use them. */
const T = {
  ar: {
    loading: 'جارٍ تحميل الصفحة', nf: 'عذراً، الصفحة غير موجودة', nfBody: 'قد يكون الرابط قديماً أو أن الصفحة نُقلت أو لم تعد متاحة. يمكنك العودة إلى الصفحة الرئيسية للمعرض.',
    err: 'حدث خطأ غير متوقع', errBody: 'تعذّر تحميل هذه الصفحة. تحقق من الاتصال ثم حاول مرة أخرى.', retry: 'إعادة المحاولة', home: 'الصفحة الرئيسية للمعرض', programme: 'البرنامج', chamber: 'موقع الغرفة',
  },
  en: {
    loading: 'Loading page', nf: 'Sorry, this page could not be found', nfBody: 'The link may be outdated, or the page may have moved or is no longer available. You can head back to the exhibition home page.',
    err: 'Something went wrong', errBody: 'This page could not be loaded. Check the connection and try again.', retry: 'Try again', home: 'Exhibition home', programme: 'Programme', chamber: 'Chamber website',
  },
};

const Pulse = ({ className = '' }: { className?: string }) => <div className={`animate-pulse rounded-lg bg-primary/15 ${className}`} />;

/** Skeleton of an EXPO page inside its own header and footer: title banner, a row of tabs and a grid of cards, in the exhibition's colours. */
export function ExpoLoader({ lang }: { lang: 'ar' | 'en' }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label={T[lang].loading} className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div className="overflow-hidden rounded-3xl bg-secondary/90 shadow-card">
        <div className="flex items-center gap-4 px-6 py-7 md:px-9">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-2xl bg-white/20" />
          <div className="flex-1 space-y-3"><div className="h-6 w-1/3 animate-pulse rounded-lg bg-white/25" /><div className="h-3 w-2/3 animate-pulse rounded-lg bg-white/15" /></div>
        </div>
        <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent" aria-hidden="true" />
      </div>
      <div className="flex gap-2"><Pulse className="h-9 w-24 !rounded-full" /><Pulse className="h-9 w-24 !rounded-full" /><Pulse className="h-9 w-24 !rounded-full" /></div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-3 rounded-2xl bg-white p-5 shadow-card ring-1 ring-line">
            <Pulse className="h-3 w-1/3" /><Pulse className="h-5 w-4/5" /><Pulse className="h-3 w-full" /><Pulse className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Shell({ icon, big, title, body, children }: { icon: React.ReactNode; big: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <section className="relative isolate mx-auto flex min-h-[55vh] max-w-6xl items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_60%)]" />
      <div className="pointer-events-none absolute -start-16 top-1/3 -z-10 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white text-center shadow-card ring-1 ring-line">
        <div className="bg-secondary px-6 py-8 text-white">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-3xl ring-1 ring-white/25" aria-hidden="true">{icon}</span>
          <p className="mt-3 text-6xl font-extrabold tracking-tight text-white/90 sm:text-7xl">{big}</p>
        </div>
        <div className="h-1 bg-gradient-to-r from-transparent via-accent to-transparent" aria-hidden="true" />
        <div className="p-8 sm:p-12">
          <h1 className="mb-3 text-2xl font-extrabold text-secondary sm:text-3xl">{title}</h1>
          <p className="mx-auto mb-8 max-w-md leading-7 text-ink/70">{body}</p>
          <div className="flex flex-wrap justify-center gap-3">{children}</div>
        </div>
      </div>
    </section>
  );
}
const primaryBtn = 'rounded-full bg-secondary px-6 py-3 text-sm font-semibold text-white shadow-card ring-1 ring-accent/50 transition hover:-translate-y-0.5 hover:brightness-110';
const ghostBtn = 'rounded-full border border-primary/30 bg-primary/5 px-6 py-3 text-sm font-semibold text-secondary transition hover:border-primary hover:bg-primary/10';

export function ExpoNotFound({ lang }: { lang: 'ar' | 'en' }) {
  const x = T[lang];
  return (
    <Shell icon="🔍" big="404" title={x.nf} body={x.nfBody}>
      <Link href={`/${lang}/expo/`} className={primaryBtn}>{x.home}</Link>
      <Link href={`/${lang}/expo/programme/`} className={ghostBtn}>{x.programme}</Link>
      <Link href={`/${lang}/`} className={ghostBtn}>{x.chamber}</Link>
    </Shell>
  );
}

export function ExpoError({ lang, onRetry }: { lang: 'ar' | 'en'; onRetry?: () => void }) {
  const x = T[lang];
  return (
    <Shell icon="⚠️" big="500" title={x.err} body={x.errBody}>
      {onRetry && <button type="button" onClick={onRetry} className={primaryBtn}>{x.retry}</button>}
      <Link href={`/${lang}/expo/`} className={ghostBtn}>{x.home}</Link>
      <Link href={`/${lang}/`} className={ghostBtn}>{x.chamber}</Link>
    </Shell>
  );
}
