'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Modal } from '@/components/ui/ui';
import { FormBySlug } from '@/components/site/dynamic-form';

export interface Space { id: number; kind: string; name: string; description: string; capacity: number | null; areaSqm: number | null; price: string; isAvailable: boolean; imageUrl: string | null }
export interface Pack { id: number; name: string; features: string[]; price: string }
export interface G2tPage { isOpen: boolean; about: string; services: string; newsTopic: string; packages: Pack[]; spaces: Space[] }
export type Kind = 'booking' | 'inquiry';
interface Ctx {
  page: G2tPage | null;
  /** opens the booking / inquiry window, optionally with a space or a package already chosen */
  openForm: (kind: Kind, pick?: { spaceId?: number; packageId?: number }) => void;
  /** loads the page content again (after a manager changed something from the top bar) */
  reload: () => void;
}
const G2tContext = createContext<Ctx | null>(null);

export function useGet2Trade() {
  const c = useContext(G2tContext);
  if (!c) throw new Error('useGet2Trade must be used inside <G2tProvider>');
  return c;
}

/**
 * Loads the Get2Trade page content once for all its tabs (about, services, packages, spaces, news) and owns the
 * booking / inquiry window, so the buttons in the top bar and the ones inside the tabs all open the same form.
 */
export function G2tProvider({ children }: { children: React.ReactNode }) {
  const { lang, t } = useI18n();
  const [page, setPage] = useState<G2tPage | null>(null);
  const [form, setForm] = useState<{ kind: Kind; spaceId?: number; packageId?: number } | null>(null);
  const [done, setDone] = useState(false);

  const [rev, setRev] = useState(0);
  useEffect(() => {
    api<G2tPage>('/public/get2trade', { params: { lang }, cache: 'no-store' }).then(setPage).catch(() => setPage((p) => p ?? { isOpen: true, about: '', services: '', newsTopic: '', packages: [], spaces: [] }));
  }, [lang, rev]);

  const openForm: Ctx['openForm'] = (kind, pick) => { setDone(false); setForm({ kind, spaceId: pick?.spaceId, packageId: pick?.packageId }); };
  const close = () => { setForm(null); setDone(false); };

  return (
    <G2tContext.Provider value={{ page, openForm, reload: () => setRev((n) => n + 1) }}>
      {children}
      <Modal open={!!form} onClose={close} title={form?.kind === 'booking' ? t('gt.formBook') : t('gt.formInquiry')} wide closeOnBackdrop={done}>
        {/* the fields are the dashboard forms "get2trade-booking" / "get2trade-inquiry" (Forms → Forms); spaces and packages in the lists come from the page's own records */}
        {form && <FormBySlug key={`${form.kind}-${form.spaceId ?? ''}-${form.packageId ?? ''}`} slug={`get2trade-${form.kind}`}
          initial={{ ...(form.spaceId ? { space: String(form.spaceId) } : {}), ...(form.packageId ? { package: String(form.packageId) } : {}) }}
          onDone={() => setDone(true)} doneExtra={<><p className="text-sm text-gray-600">{t('gt.receivedHint')}</p><div className="mt-3"><Button type="button" onClick={close}>{t('gt.close')}</Button></div></>} />}
      </Modal>
    </G2tContext.Provider>
  );
}
