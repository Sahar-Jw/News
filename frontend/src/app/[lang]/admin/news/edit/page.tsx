'use client';
import { RequirePerm } from '@/components/admin/guard';
import NewsForm from '@/components/admin/news-form';
import { anyNewsPerm } from '@/lib/utils';

export default function EditNews() {
  // coarse gate: any create/update permission; the form then checks the exact one for the record's own section
  return <RequirePerm any={[...anyNewsPerm('create'), ...anyNewsPerm('update')]}><NewsForm /></RequirePerm>;
}
