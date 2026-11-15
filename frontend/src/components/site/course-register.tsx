'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Button, Modal } from '@/components/ui/ui';
import { FormBySlug } from '@/components/site/dynamic-form';

/** "Register now" window of one course. The fields are the dashboard form "course-registration" (Forms → Forms); the course itself is checked on the server (open, seats left, one registration per e-mail). */
export function CourseRegister({ courseId, courseName, open, onClose, onDone }: { courseId: number; courseName: string; open: boolean; onClose: () => void; onDone?: () => void }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  const close = () => { onClose(); setDone(false); };
  return (
    <Modal open={open} onClose={close} title={`${t('tr.regTitle')}: ${courseName}`} wide>
      <FormBySlug slug="course-registration" context={{ courseId }} onDone={() => { setDone(true); onDone?.(); }}
        doneExtra={done ? <Button type="button" onClick={close}>{t('app.close')}</Button> : undefined} />
    </Modal>
  );
}
