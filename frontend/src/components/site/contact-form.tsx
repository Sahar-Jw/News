'use client';
import { FormBySlug } from '@/components/site/dynamic-form';

/**
 * Every "contact us" box of the site (home page, contact page, One-Stop, services, women's committee). Its fields are the dashboard form "contact".
 * `subjectPrefix` is added in front of the subject when sending (e.g. to tag inquiries from the One-Stop page).
 */
export function ContactForm({ subjectPrefix = '' }: { subjectPrefix?: string }) {
  return <FormBySlug slug="contact" prefix={subjectPrefix ? { subject: subjectPrefix } : undefined} />;
}
