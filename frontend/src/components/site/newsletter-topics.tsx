'use client';
import { useI18n } from '@/lib/i18n';

/** Must match NEWSLETTER_TOPICS in backend/src/common/newsletter-topics.ts. */
export const NEWSLETTER_TOPIC_KEYS = ['news', 'courses', 'events', 'decisions', 'circulars', 'economic', 'committees'] as const;

/** Check boxes of the newsletter topics (used by the home subscribe box and by the "manage my subscription" page). */
export function NewsletterTopics({ value, onChange, className = '' }: { value: string[]; onChange: (v: string[]) => void; className?: string }) {
  const { t } = useI18n();
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div role="group" aria-label={t('sub.topics')} className={`grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 ${className}`}>
      {NEWSLETTER_TOPIC_KEYS.map((k) => (
        <label key={k} className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={value.includes(k)} onChange={() => toggle(k)} className="h-4 w-4 accent-[var(--color-primary,#2748e8)]" />
          <span>{t(`sub.topic.${k}`)}</span>
        </label>
      ))}
    </div>
  );
}
