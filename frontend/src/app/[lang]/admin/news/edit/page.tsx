'use client';
import { RequirePerm } from '@/components/admin/guard';
import NewsForm from '@/components/admin/news-form';

export default function EditNews() {
  return <RequirePerm any={['news.create', 'news.update']}><NewsForm /></RequirePerm>;
}
