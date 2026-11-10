import { CC, RESERVED_CATEGORY_CODES } from './content-categories';

/** What a subscriber can choose to receive. Order = display order. */
export const NEWSLETTER_TOPICS = ['news', 'courses', 'events', 'decisions', 'circulars', 'economic', 'committees'] as const;
export type NewsletterTopic = (typeof NEWSLETTER_TOPICS)[number];

export const NEWSLETTER_TOPIC_LABELS: Record<NewsletterTopic, { ar: string; en: string }> = {
  news: { ar: 'الأخبار', en: 'News' },
  courses: { ar: 'الدورات', en: 'Courses' },
  events: { ar: 'الفعاليات', en: 'Events' },
  decisions: { ar: 'القرارات', en: 'Decisions' },
  circulars: { ar: 'التعاميم', en: 'Circulars' },
  economic: { ar: 'الفرص الاقتصادية', en: 'Economic opportunities' },
  committees: { ar: 'أخبار اللجان', en: 'Committee news' },
};

const COMMITTEE_ITEMS: string[] = [CC.COMMITTEE_MEETING, CC.COMMITTEE_VISIT, CC.COMMITTEE_RECOMMENDATION, CC.COMMITTEE_INITIATIVE, CC.COMMITTEE_OUTPUT, CC.COMMITTEE_EVENT, CC.COMMITTEE_SUCCESS];
/** Main categories that count as an "economic opportunity". Change this list to change what the topic sends. */
const ECONOMIC_ITEMS: string[] = [CC.G2T_PACKAGE, CC.G2T_SPACE];

/** The newsletter topic a `news` row belongs to, or null when that kind of row is never e-mailed (FAQ, pages, board, trainers ...). */
export function topicOfCategory(main: string): NewsletterTopic | null {
  if (main === CC.COURSE) return 'courses';
  if (main === CC.OCCASION) return 'events';
  if (main === 'DOC_DECISION') return 'decisions';
  if (main === 'DOC_CIRCULAR') return 'circulars';
  if (ECONOMIC_ITEMS.includes(main)) return 'economic';
  if (COMMITTEE_ITEMS.includes(main)) return 'committees';
  if (!RESERVED_CATEGORY_CODES.includes(main)) return 'news';
  return null;
}

/** Site path (after /<lang>) of the page that shows a row. */
export function pathOfCategory(main: string, id: number | string): string {
  if (main === CC.COURSE) return `/training/view/?id=${id}`;
  if (main === CC.OCCASION) return `/occasions/view/?id=${id}`;
  if (main === 'DOC_DECISION' || main === 'DOC_CIRCULAR') return `/documents/view/?id=${id}`;
  if (main === CC.G2T_PACKAGE || main === CC.G2T_SPACE) return '/get2trade/';
  return `/news/view/?id=${id}`;
}

/** Keeps only known topics. Nothing chosen, or every topic chosen, is stored as null = "everything" (so new topics reach old subscribers too). */
export function normalizeTopics(v: unknown): NewsletterTopic[] | null {
  if (!Array.isArray(v)) return null;
  const set = new Set(v.filter((x): x is NewsletterTopic => (NEWSLETTER_TOPICS as readonly string[]).includes(x as string)));
  if (set.size === 0 || set.size === NEWSLETTER_TOPICS.length) return null;
  return NEWSLETTER_TOPICS.filter((t) => set.has(t));
}
