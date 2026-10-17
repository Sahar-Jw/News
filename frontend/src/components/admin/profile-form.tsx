'use client';
import { useEffect, useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Button, Field, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

interface City { id: number; nameAr: string; nameEn: string }

/** Own profile only. Role, permissions and activation are not editable here (the API ignores them anyway). */
export function ProfileForm() {
  const { t, lang } = useI18n();
  const { me, refresh, can } = useAuth();
  const toast = useToast();
  const [cities, setCities] = useState<City[]>([]);
  const [newCity, setNewCity] = useState({ code: '', nameAr: '', nameEn: '' });
  const [f, setF] = useState({ fullName: me?.fullName ?? '', phone: me?.phone ?? '', gender: me?.gender ?? '', country: me?.country ?? '', cityId: me?.city ? String(me.city.id) : '', nationality: me?.nationality ?? '', bio: me?.bio ?? '', socialLink: me?.socialLink ?? '', isExpert: !!me?.isExpert, isResearcher: !!me?.isResearcher });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { api<City[]>('/public/cities').then(setCities).catch(() => {}); }, []);

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
  const addCity = async () => {
    try {
      const c = await api<City>('/admin/cities', { method: 'POST', body: newCity });
      setCities([...cities, c]); set('cityId', String(c.id)); setNewCity({ code: '', nameAr: '', nameEn: '' });
    } catch (e: any) { toast(e.message, 'err'); }
  };
  if (!me) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('site.profile')}</h1>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-5">
        {me.avatarUrl ? <img src={fileUrl(me.avatarUrl)} alt="" className="h-20 w-20 rounded-full object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl text-white">{me.fullName.slice(0, 1)}</div>}
        <div className="space-y-2">
          <div className="font-bold">{me.fullName} <span className="text-sm font-normal text-gray-500">({lang === 'ar' ? me.role?.nameAr : me.role?.nameEn})</span></div>
          <div className="flex flex-wrap gap-3 text-sm">
            <label className="cursor-pointer rounded border px-3 py-1 hover:bg-gray-50">{t('u.avatar')}<input type="file" accept="image/*" className="hidden" onChange={(e) => up('/profile/avatar', e.target.files?.[0])} /></label>
            <label className="cursor-pointer rounded border px-3 py-1 hover:bg-gray-50">{t('u.cv')}{me.hasCv ? ' ✓' : ''}<input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => up('/profile/cv', e.target.files?.[0])} /></label>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
        <Field label={t('u.name')}><input required minLength={2} className={inputCls} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} /></Field>
        <Field label={t('u.email')}><input disabled dir="ltr" className={inputCls} value={me.email} /></Field>
        <Field label={t('u.phone')}><input dir="ltr" className={inputCls} value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label={t('u.gender')}><select className={inputCls} value={f.gender} onChange={(e) => set('gender', e.target.value)}><option value="">—</option><option value="male">{t('u.male')}</option><option value="female">{t('u.female')}</option></select></Field>
        <Field label={t('u.country')}><input className={inputCls} value={f.country} onChange={(e) => set('country', e.target.value)} /></Field>
        <Field label={t('u.city')}>
          <select className={inputCls} value={f.cityId} onChange={(e) => set('cityId', e.target.value)}><option value="">—</option>{cities.map((c) => <option key={c.id} value={c.id}>{lang === 'ar' ? c.nameAr : c.nameEn}</option>)}</select>
        </Field>
        <Field label={t('u.nationality')}><input className={inputCls} value={f.nationality} onChange={(e) => set('nationality', e.target.value)} /></Field>
        <Field label={t('u.social')}><input type="url" dir="ltr" className={inputCls} value={f.socialLink} onChange={(e) => set('socialLink', e.target.value)} placeholder="https://" /></Field>
        <div className="md:col-span-2"><Field label={t('u.bio')}><textarea rows={4} maxLength={5000} className={inputCls} value={f.bio} onChange={(e) => set('bio', e.target.value)} /></Field></div>
        {/* display-only labels: they never grant permissions */}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isExpert} onChange={(e) => set('isExpert', e.target.checked)} />{t('u.expert')}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isResearcher} onChange={(e) => set('isResearcher', e.target.checked)} />{t('u.researcher')}</label>
        <div className="md:col-span-2"><Button>{t('app.save')}</Button></div>
      </form>

      {can('cities.create') && (
        <div className="grid gap-3 rounded-xl border bg-white p-5 md:grid-cols-4">
          <input dir="ltr" placeholder={t('u.cityCode')} className={inputCls} value={newCity.code} onChange={(e) => setNewCity({ ...newCity, code: e.target.value })} />
          <input placeholder={t('u.cityAr')} className={inputCls} value={newCity.nameAr} onChange={(e) => setNewCity({ ...newCity, nameAr: e.target.value })} />
          <input dir="ltr" placeholder={t('u.cityEn')} className={inputCls} value={newCity.nameEn} onChange={(e) => setNewCity({ ...newCity, nameEn: e.target.value })} />
          <Button type="button" variant="outline" onClick={addCity}>{t('u.addCity')}</Button>
        </div>
      )}

      <form onSubmit={changePw} className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-3 md:items-end">
        <Field label={t('u.currentPassword')}><input required type="password" dir="ltr" className={inputCls} value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
        <Field label={t('u.newPassword')}><input required minLength={8} maxLength={72} type="password" dir="ltr" className={inputCls} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
        <Button>{t('u.changePassword')}</Button>
      </form>
    </div>
  );
}
