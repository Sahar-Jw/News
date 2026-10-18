'use client';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, FilePicker, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

interface City { id: number; nameAr: string; nameEn: string }

interface Country { id: number; nameAr: string; nameEn: string }
const NEW = '__new__';

/** Select that also lets users with the permission add a missing entry (name in Arabic + English) without leaving the form. */
function SelectWithAdd({ label, value, onChange, options, canAdd, addOption, arLabel, enLabel, onCreate }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  canAdd: boolean; addOption: string; arLabel: string; enLabel: string; onCreate: (nameAr: string, nameEn: string) => Promise<string>;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [ar, setAr] = useState('');
  const [en, setEn] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = ar.trim().length >= 2 && en.trim().length >= 2;
  const close = () => { setAdding(false); setAr(''); setEn(''); };
  const create = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try { onChange(await onCreate(ar.trim(), en.trim())); close(); } catch (e: any) { toast(e.message, 'err'); } finally { setBusy(false); }
  };
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); create(); } };
  const known = options.some((o) => o.value === value);
  return (
    <div className={adding ? 'md:col-span-2' : ''}>
      <Field label={label}>
        <select className={inputCls} value={value} onChange={(e) => (e.target.value === NEW ? setAdding(true) : onChange(e.target.value))}>
          <option value="">—</option>
          {value && !known && <option value={value}>{value}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          {canAdd && <option value={NEW}>＋ {addOption}</option>}
        </select>
      </Field>
      {adding && (
        <div className="mt-2 grid gap-2 rounded-lg border bg-gray-50 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input autoFocus placeholder={arLabel} className={inputCls} value={ar} onChange={(e) => setAr(e.target.value)} onKeyDown={enter} maxLength={100} />
          <input dir="ltr" placeholder={enLabel} className={inputCls} value={en} onChange={(e) => setEn(e.target.value)} onKeyDown={enter} maxLength={100} />
          <Button type="button" disabled={!valid || busy} onClick={create}>{busy ? t('app.loading') : t('app.add')}</Button>
          <Button type="button" variant="ghost" onClick={close}>{t('app.cancel')}</Button>
        </div>
      )}
    </div>
  );
}

/** Own profile only. Role, permissions and activation are not editable here (the API ignores them anyway). */
export function ProfileForm() {
  const { t, lang } = useI18n();
  const { me, refresh, can } = useAuth();
  const toast = useToast();
  const [cities, setCities] = useState<City[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [f, setF] = useState({ fullName: me?.fullName ?? '', phone: me?.phone ?? '', gender: me?.gender ?? '', country: me?.country ?? '', cityId: me?.city ? String(me.city.id) : '', nationality: me?.nationality ?? '', bio: me?.bio ?? '', socialLink: me?.socialLink ?? '', isExpert: !!me?.isExpert, isResearcher: !!me?.isResearcher });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    api<City[]>('/public/cities').then(setCities).catch(() => {});
    api<Country[]>('/public/countries').then(setCountries).catch(() => {});
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api('/profile', { method: 'PATCH', body: { ...f, cityId: f.cityId ? Number(f.cityId) : '' } });
      await refresh(); toast(t('app.saved'));
    } catch (err: any) { toast(err.message, 'err'); }
  };
  const up = async (path: string, file?: File | null) => {
    if (!file) return;
    const fd = new FormData(); fd.set('file', file);
    try { await api(path, { method: 'POST', form: fd }); await refresh(); toast(t('app.saved')); } catch (e: any) { toast(e.message, 'err'); }
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api('/profile/password', { method: 'POST', body: pw }); setPw({ currentPassword: '', newPassword: '' }); toast(t('app.saved')); } catch (err: any) { toast(err.message, 'err'); }
  };
  const addCity = async (nameAr: string, nameEn: string) => {
    const c = await api<City>('/admin/cities', { method: 'POST', body: { nameAr, nameEn } });
    setCities((l) => [...l, c]);
    return String(c.id);
  };
  const addCountry = async (nameAr: string, nameEn: string) => {
    const c = await api<Country>('/admin/countries', { method: 'POST', body: { nameAr, nameEn } });
    setCountries((l) => [...l, c]);
    return c.nameEn; // users.country stores the English name
  };
  if (!me) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('site.profile')}</h1>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-5">
        {me.avatarUrl ? <img src={fileUrl(me.avatarUrl)} alt="" className="h-20 w-20 rounded-full object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl text-white">{me.fullName.slice(0, 1)}</div>}
        <div className="space-y-2">
          <div className="font-bold">{me.fullName} <span className="text-sm font-normal text-gray-500">({lang === 'ar' ? me.role?.nameAr : me.role?.nameEn})</span></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <FilePicker label={t('u.avatar')} hint="JPG, PNG or WEBP" accept="image/*" onChange={(files) => up('/profile/avatar', files?.[0])} />
            <FilePicker label={`${t('u.cv')}${me.hasCv ? ' ✓' : ''}`} hint="PDF, DOC or DOCX" accept=".pdf,.doc,.docx" onChange={(files) => up('/profile/cv', files?.[0])} />
          </div>
        </div>
      </div>

      <form onSubmit={save} className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
        <Field label={t('u.name')}><input required minLength={2} className={inputCls} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
        <Field label={t('u.email')}><input disabled dir="ltr" className={inputCls} value={me.email} /></Field>
        <Field label={t('u.phone')}><input dir="ltr" className={inputCls} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label={t('u.gender')}><select className={inputCls} value={f.gender} onChange={(e) => set('gender', e.target.value)}><option value="">—</option><option value="male">{t('u.male')}</option><option value="female">{t('u.female')}</option></select></Field>
        <SelectWithAdd
          label={t('u.country')} value={f.country} onChange={(v) => set('country', v)}
          options={countries.map((c) => ({ value: c.nameEn, label: lang === 'ar' ? c.nameAr : c.nameEn }))}
          canAdd={can('countries.create')} addOption={t('u.addCountry')} arLabel={t('u.countryAr')} enLabel={t('u.countryEn')} onCreate={addCountry}
        />
        <SelectWithAdd
          label={t('u.city')} value={f.cityId} onChange={(v) => set('cityId', v)}
          options={cities.map((c) => ({ value: String(c.id), label: lang === 'ar' ? c.nameAr : c.nameEn }))}
          canAdd={can('cities.create')} addOption={t('u.addCity')} arLabel={t('u.cityAr')} enLabel={t('u.cityEn')} onCreate={addCity}
        />
        <Field label={t('u.nationality')}><input className={inputCls} value={f.nationality} onChange={(e) => set('nationality', e.target.value)} /></Field>
        <Field label={t('u.social')}><input type="url" dir="ltr" className={inputCls} value={f.socialLink} onChange={(e) => set('socialLink', e.target.value)} placeholder="https://" /></Field>
        <div className="md:col-span-2"><Field label={t('u.bio')}><textarea rows={4} maxLength={5000} className={inputCls} value={f.bio} onChange={(e) => set('bio', e.target.value)} /></Field></div>
        {/* display-only labels: they never grant permissions */}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isExpert} onChange={(e) => set('isExpert', e.target.checked)} />{t('u.expert')}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isResearcher} onChange={(e) => set('isResearcher', e.target.checked)} />{t('u.researcher')}</label>
        <div className="md:col-span-2"><Button>{t('app.save')}</Button></div>
      </form>

      <form onSubmit={changePw} className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-3 md:items-end">
        <Field label={t('u.currentPassword')}><input required type="password" dir="ltr" className={inputCls} value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
        <Field label={t('u.newPassword')}><input required minLength={8} maxLength={72} type="password" dir="ltr" className={inputCls} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
        <Button>{t('u.changePassword')}</Button>
      </form>
    </div>
  );
}
