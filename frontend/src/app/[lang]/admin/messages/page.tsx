'use client';
import { useI18n } from '@/lib/i18n';
import { FormSubmissionsAdmin } from '@/components/admin/forms-admin';
import { RequirePerm } from '@/components/admin/guard';

/** Contact messages are the requests of the dashboard form "contact" (same screen as every other form: read, status, reply by e-mail, export). */
export default function MessagesPage() {
  const { t } = useI18n();
  return (
    <RequirePerm any={['forms.submissions.read']}>
      <h1 className="mb-4 text-2xl font-bold">{t('adm.messages')}</h1>
      <FormSubmissionsAdmin slugs={['contact']} />
    </RequirePerm>
  );
}
