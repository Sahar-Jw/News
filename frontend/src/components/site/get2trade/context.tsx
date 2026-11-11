'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button, Field, Modal, inputCls } from '@/components/ui/ui';

export interface Space { id: number; kind: string; name: string; description: string; capacity: number | null; areaSqm: number | null; price: string; isAvailable: boolean; imageUrl: string | null }
export interface Pack { id: number; name: string; features: string[]; price: string }
export interface G2tPage { isOpen: boolean; about: string; services: string; newsTopic: string; packages: Pack[]; spaces: Space[] }
export type Kind = 'booking' | 'inquiry';
type V = { name: string; company: string; email: string; phone: string; spaceId: string; packageId: string; spaceKind: string; startDate: string; durationValue: string; durationUnit: string; people: string; extraServices: string; message: string };
type Errors = Partial<Record<keyof V, string>>;

const EMPTY: V = { name: '', company: '', email: '', phone: '', spaceId: '', packageId: '', spaceKind: '', startDate: '', durationValue: '', durationUnit: 'month', people: '', extraServices: '', message: '' };
const KINDS = ['office', 'coworking', 'meeting_room', 'other'];
const UNITS = ['day', 'week', 'month', 'year'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+0-9()\-\s]{6,30}$/;
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the visitor's timezone

interface Ctx {
  page: G2tPage | null;
  /** opens the booking / inquiry window, optionally with a space or a package already chosen */
  openForm: (kind: Kind, pick?: { spaceId?: number; packageId?: number }) => void;
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
  const [form, setForm] = useState<{ kind: Kind } | null>(null);
  const [v, setV] = useState<V>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    api<G2tPage>('/public/get2trade', { params: { lang }, cache: 'no-store' }).then(setPage).catch(() => setPage({ isOpen: true, about: '', services: '', newsTopic: '', packages: [], spaces: [] }));
  }, [lang]);

  const openForm: Ctx['openForm'] = (kind, pick) => {
    setV({ ...EMPTY, spaceId: pick?.spaceId ? String(pick.spaceId) : '', packageId: pick?.packageId ? String(pick.packageId) : '' });
    setErrors({}); setServerError(''); setDone(null); setForm({ kind });
  };
  const close = () => { setForm(null); setDone(null); };
  const set = (k: keyof V, val: string) => { setV((p) => ({ ...p, [k]: val })); setErrors((p) => ({ ...p, [k]: undefined })); setServerError(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const err: Errors = {};
    if (v.name.trim().length < 2) err.name = t('gt.nameRequired');
    else if (form.kind === 'booking' && v.name.trim().split(/\s+/).length < 3) err.name = t('gt.nameThree');
    if (!EMAIL_RE.test(v.email.trim())) err.email = t('gt.emailInvalid');
    if (!PHONE_RE.test(v.phone.trim())) err.phone = t('gt.phoneInvalid');
    if (v.startDate && v.startDate < today()) err.startDate = t('gt.dateInvalid');
    if (v.people.trim() && !(/^\d+$/.test(v.people.trim()) && Number(v.people) >= 1 && Number(v.people) <= 500)) err.people = t('gt.peopleInvalid');
    if (v.durationValue.trim() && !(/^\d+$/.test(v.durationValue.trim()) && Number(v.durationValue) >= 1 && Number(v.durationValue) <= 120)) err.durationValue = t('gt.durationInvalid');
    if (form.kind === 'inquiry' && v.message.trim().length < 5) err.message = t('gt.messageRequired');
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    setServerError('');
    try {
      const r = await api<{ reference: string }>('/public/get2trade/bookings', {
        method: 'POST',
        body: { kind: form.kind, name: v.name.trim(), company: v.company.trim(), email: v.email.trim(), phone: v.phone.trim(), spaceId: v.spaceId, packageId: v.packageId, spaceKind: v.spaceId ? '' : v.spaceKind, startDate: v.startDate, durationValue: v.durationValue.trim(), durationUnit: v.durationValue.trim() ? v.durationUnit : '', people: v.people.trim(), extraServices: v.extraServices.trim(), message: v.message.trim() },
      });
      setDone(r.reference);
    } catch (e2: any) { setServerError(e2.message); }
    finally { setBusy(false); }
  };

  const cls = (bad?: string) => `${inputCls} ${bad ? 'border-red-500' : ''}`;

  return (
    <G2tContext.Provider value={{ page, openForm }}>
      {children}
      <Modal open={!!form} onClose={close} title={form?.kind === 'booking' ? t('gt.formBook') : t('gt.formInquiry')} wide closeOnBackdrop={!!done}>
        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-lg font-bold text-secondary">{t('gt.received')}</p>
            <p>{t('gt.reference')}: <b dir="ltr" className="text-primary">{done}</b></p>
            <p className="text-sm text-gray-600">{t('gt.receivedHint')}</p>
            <Button type="button" onClick={close}>{t('gt.close')}</Button>
          </div>
        ) : form && page && (
          <form onSubmit={submit} noValidate className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label={t('gt.name')} error={errors.name}><input className={cls(errors.name)} maxLength={150} autoComplete="name" aria-invalid={!!errors.name} value={v.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label={t('gt.company')}><input className={inputCls} maxLength={150} autoComplete="organization" value={v.company} onChange={(e) => set('company', e.target.value)} /></Field>
              <Field label={t('contact.email')} error={errors.email}><input type="email" dir="ltr" className={cls(errors.email)} maxLength={190} autoComplete="email" aria-invalid={!!errors.email} value={v.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label={t('site.phone')} error={errors.phone}><input type="tel" dir="ltr" className={cls(errors.phone)} maxLength={30} autoComplete="tel" aria-invalid={!!errors.phone} value={v.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label={t('gt.space')}><select className={inputCls} value={v.spaceId} onChange={(e) => set('spaceId', e.target.value)}><option value="">{t('gt.noneChosen')}</option>{page.spaces.filter((s) => form.kind === 'inquiry' || s.isAvailable).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
              {!v.spaceId && <Field label={t('gt.spaceKind')}><select className={inputCls} value={v.spaceKind} onChange={(e) => set('spaceKind', e.target.value)}><option value="">{t('gt.noneChosen')}</option>{KINDS.map((k) => <option key={k} value={k}>{t(`gt.kind.${k}`)}</option>)}</select></Field>}
              <Field label={t('gt.package')}><select className={inputCls} value={v.packageId} onChange={(e) => set('packageId', e.target.value)}><option value="">{t('gt.noneChosen')}</option>{page.packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
              {form.kind === 'booking' && <Field label={t('gt.startDate')} error={errors.startDate}><input type="date" dir="ltr" min={today()} className={cls(errors.startDate)} aria-invalid={!!errors.startDate} value={v.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>}
              {form.kind === 'booking' && (
                <Field label={t('gt.duration')} error={errors.durationValue}>
                  <div className="flex gap-2">
                    <input inputMode="numeric" dir="ltr" className={`${cls(errors.durationValue)} w-24`} aria-invalid={!!errors.durationValue} value={v.durationValue} onChange={(e) => set('durationValue', e.target.value)} />
                    <select className={inputCls} aria-label={t('gt.duration')} value={v.durationUnit} onChange={(e) => set('durationUnit', e.target.value)}>{UNITS.map((u) => <option key={u} value={u}>{t(`gt.unit.${u}`)}</option>)}</select>
                  </div>
                </Field>
              )}
              <Field label={t('gt.peopleCount')} error={errors.people}><input inputMode="numeric" dir="ltr" className={cls(errors.people)} aria-invalid={!!errors.people} value={v.people} onChange={(e) => set('people', e.target.value)} /></Field>
            </div>
            {form.kind === 'booking' && <Field label={t('gt.extraServices')}><textarea rows={2} maxLength={1000} className={inputCls} value={v.extraServices} onChange={(e) => set('extraServices', e.target.value)} /></Field>}
            <Field label={t(form.kind === 'inquiry' ? 'gt.inquiryText' : 'gt.message')} error={errors.message}><textarea rows={4} maxLength={3000} className={cls(errors.message)} aria-invalid={!!errors.message} value={v.message} onChange={(e) => set('message', e.target.value)} /></Field>
            {serverError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{serverError}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{t('app.cancel')}</Button><Button disabled={busy}>{t('gt.send')}</Button></div>
          </form>
        )}
      </Modal>
    </G2tContext.Provider>
  );
}
