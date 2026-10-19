import Link from 'next/link';

export function NotFoundContent({ lang }: { lang: 'ar' | 'en' }) {
  const isArabic = lang === 'ar';

  return (
    <section className="relative isolate flex min-h-[60vh] items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_58%)]" />
      <div className="pointer-events-none absolute -start-16 top-1/3 -z-10 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
      <div className="w-full max-w-2xl rounded-[2rem] border border-line/80 bg-white/85 p-8 text-center shadow-lift backdrop-blur-sm sm:p-14">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
          <svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="22" cy="22" r="14" />
            <path d="m32 32 10 10M17 18h.01M27 18h.01M17 27c2.5-3 7.5-3 10 0" />
          </svg>
        </div>
        <p className="mb-2 font-display text-7xl font-extrabold tracking-tight text-primary sm:text-8xl">404</p>
        <h1 className="mb-3 font-display text-2xl font-bold text-secondary sm:text-3xl">
          {isArabic ? 'عذراً، الصفحة غير موجودة' : 'Sorry, this page could not be found'}
        </h1>
        <p className="mx-auto mb-8 max-w-md leading-7 text-muted">
          {isArabic
            ? 'قد يكون الرابط قديماً أو أن الصفحة نُقلت. يمكنك العودة إلى الصفحة الرئيسية ومتابعة التصفح.'
            : 'The link may be outdated or the page may have moved. Head back to the homepage to continue browsing.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href={`/${lang}/`} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:brightness-110">
            {isArabic ? 'الرئيسية' : 'Home'}
          </Link>
          <Link href={`/${lang}/news/`} className="rounded-full border border-primary/20 bg-primary/5 px-6 py-3 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/10">
            {isArabic ? 'كل الأخبار' : 'All news'}
          </Link>
        </div>
      </div>
    </section>
  );
}
