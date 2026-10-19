'use client';
import { RequirePerm } from '@/components/admin/guard';
import NewsForm from '@/components/admin/news-form';
import { SECTIONS, createPermFor } from '@/lib/utils';

export default function EditNews() {
  // creating needs the permission of the chosen section (the form checks which one); editing needs news.update
  return <RequirePerm any={[createPermFor(), ...SECTIONS.map(createPermFor), 'news.update']}><NewsForm /></RequirePerm>;
}
