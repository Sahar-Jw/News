'use client';
import { FormBySlug } from '@/components/site/dynamic-form';

/**
 * Every "contact us" box of the site. The home and contact pages use the main dashboard form "contact"; the One-Stop / service pages and the women's committee page each have their own form (`slug`), so their messages are managed from their own page's settings.
 * `subjectPrefix` is added in front of the subject when sending (e.g. to tag inquiries from the One-Stop page).
 */
export function ContactForm({ subjectPrefix = '', slug = 'contact' }: { subjectPrefix?: string; slug?: 'contact' | 'contact-one-stop' | 'contact-women' }) {
  return <FormBySlug slug={slug} prefix={subjectPrefix ? { subject: subjectPrefix } : undefined} />;
}
