'use client';
import { EventsHub } from '@/components/site/events-hub';

/** Kept so the old menu links keep working: opens the unified page on the occasions tab. */
export default function Page() {
  return <EventsHub initialTab="occasions" initialStatus="current" />;
}
