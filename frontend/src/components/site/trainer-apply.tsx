'use client';
import { FormBySlug } from '@/components/site/dynamic-form';

/** Public "register as a trainer" form. Its fields (personal data, training fields, CV, certificates) are the dashboard form "trainer-application". */
export function TrainerApplyForm() {
  return <FormBySlug slug="trainer-application" />;
}
