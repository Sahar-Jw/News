'use client';
import { asList } from '@/lib/list';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, fileUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { SECTIONS, newsPerm, toLocalInput } from '@/lib/utils';
import { Button, Center, Field, FilePicker, Modal, Spinner, Stars, inputCls } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';
import { parseYoutubeId } from '@/lib/youtube';
import { YoutubeEmbed } from '@/components/site/youtube-embed';
import { RichEditor } from './rich-editor';

interface Existing {
  id: number; title: string; subject: string | null; mainCategory: string; subcategory: string | null; topics: string[] | null; body: string | null;
  images: string[] | null; imageUrls: string[]; pdf: string | null; youtubeUrl: string | null; rating: number | null; isFeatured: boolean; publishAt: string | null; status: string; language: string; visibility: string;
}
interface NewImg { file: File; url: string }
const NEW = '__new__';

function Form() {
  const { t, href, lang, dir } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get('id');
  const sectionParam = sp.get('section') ?? '';
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [cats, setCats] = useState<{ main: string[]; sub: string[] }>({ main: [], sub: [] });
  const [f, setF] = useState({
    title: '', subject: '', mainCategory: '', newMain: '', subcategory: '', newSub: '', topics: '', body: '', youtubeUrl: '', rating: '', isFeatured: false,
    publishAt: id ? '' : toLocalInput(new Date().toISOString()), status: 'published', language: lang as string, visibility: 'public',
  });
  const [existing, setExisting] = useState<string[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<NewImg[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfOld, setPdfOld] = useState<string | null>(null); // path of the saved PDF
  const [pdfGone, setPdfGone] = useState(false);
  const [zoom, setZoom] = useState('');
  const [preview, setPreview] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));
  // Special section: category is pinned. When editing a record we learn its section from the record itself.
  const section = sectionParam || (SECTIONS as readonly string[]).includes(f.mainCategory) ? (sectionParam || f.mainCategory) : '';
  const special = !!section;
  const single = section === 'TEAM' || section === 'COMPANY_OVERVIEW'; // these records have exactly one picture
  const mayChangeCategory = !isEdit || can('news.category.change');
  const mayCreateCategory = can('news.category.create');
  const mayPublish = can('news.publish');
  const mayFeature = can('news.feature');

  useEffect(() => {
    api<{ main: string[]; sub: string[] }>('/admin/news/categories').then(setCats).catch(() => {});
  }, []);
  useEffect(() => {
    if (!id) return;
    api<Existing>(`/admin/news/${id}`).then((n) => {
      setF({
        title: n.title, subject: n.subject ?? '', mainCategory: n.mainCategory, newMain: '', subcategory: n.subcategory ?? '', newSub: '', topics: asList(n.topics).join(', '),
        body: n.body ?? '', youtubeUrl: n.youtubeUrl ?? '', rating: n.rating ? String(n.rating) : '', isFeatured: n.isFeatured, publishAt: toLocalInput(n.publishAt), status: n.status, language: n.language, visibility: n.visibility,
      });
      setExisting(asList(n.images));
      setPdfOld(n.pdf ?? null);
      setEditorKey((k) => k + 1);
    }).catch((e) => toast(e.message, 'err')).finally(() => setLoading(false));
    // eslint-disable-next-line
  }, [id]);

  const urlOf = (p: string) => fileUrl(`/api/files/${p}`);
  const isPdf = (x: File) => x.type === 'application/pdf' || /\.pdf$/i.test(x.name);
  // one picker for pictures and the PDF: the PDF goes to its own slot, pictures to the gallery
  const addFiles = (all: FileList | null) => {
    if (!all) return;
    const pdfs = [...all].filter(isPdf);
    const list = [...all].filter((x) => !isPdf(x));
    if (pdfs.length) {
      if (special) toast('JPG/PNG/WEBP/GIF', 'err');
      else addPdf(pdfs[0]);
    }
    if (!list.length) return;
    const next = list.filter((x) => /^image\//.test(x.type) && x.size <= 5 * 1024 * 1024);
    if (next.length !== list.length) toast('JPG/PNG/WEBP/GIF ≤ 5MB', 'err');
    if (single) {
      // the new picture replaces the old one
      if (!next.length) return;
      fresh.forEach((i) => URL.revokeObjectURL(i.url));
      setRemoved(new Set(existing));
      setFresh([{ file: next[0], url: URL.createObjectURL(next[0]) }]);
      return;
    }
    setFresh((s) => [...s, ...next.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const addPdf = (file: File) => {
    if (file.size > 25 * 1024 * 1024) return toast('PDF ≤ 25MB', 'err');
    setPdfFile(file);
    setPdfGone(false);
  };

  const ytId = parseYoutubeId(f.youtubeUrl);
  const ytBad = !!f.youtubeUrl.trim() && !ytId;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!special && ytBad) return toast(t('f.youtubeInvalid'), 'err');
    if (f.status === 'scheduled' && !f.publishAt) return toast(t('f.publishAt'), 'err');
    const main = f.mainCategory === NEW ? f.newMain.trim() : f.mainCategory;
    const sub = f.subcategory === NEW ? f.newSub.trim() : f.subcategory;
    const fd = new FormData();
    fd.set('title', f.title);
    fd.set('subject', f.subject);
    fd.set('language', f.language);
    fd.set('visibility', f.visibility);
    fd.set('topics', f.topics);
    fd.set('body', f.body);
    if (!special) fd.set('youtubeUrl', f.youtubeUrl.trim());
    if (mayFeature) fd.set('isFeatured', String(f.isFeatured));
    if (mayPublish) {
      fd.set('status', f.status);
      fd.set('publishAt', f.publishAt ? new Date(f.publishAt).toISOString() : '');
    }
    if (section === 'TESTIMONIALS' || f.mainCategory === 'TESTIMONIALS') fd.set('rating', f.rating);
    if (!isEdit) {
      if (sectionParam) fd.set('section', sectionParam);
      else fd.set('mainCategory', main);
    } else if (mayChangeCategory && main) fd.set('mainCategory', main);
    if (!special) fd.set('subcategory', sub);
    if (isEdit) fd.set('keepImages', JSON.stringify(existing.filter((p) => !removed.has(p))));
    fresh.forEach((i) => fd.append('images', i.file));
    if (!special) {
      if (pdfFile) fd.append('pdf', pdfFile);
      else if (isEdit && pdfGone) fd.set('removePdf', 'true');
    }

    setBusy(true);
    try {
      await api(isEdit ? `/admin/news/${id}` : '/admin/news', { method: isEdit ? 'PATCH' : 'POST', form: fd });
      toast(t('app.saved'));
      router.push(href(special ? `/admin/sections/${section}` : '/admin/news'));
    } catch (err: any) { toast(err.message, 'err'); } finally { setBusy(false); }
  };

  const back = href(special ? `/admin/sections/${section}` : '/admin/news');
  const sectionOptions = useMemo(() => [...cats.main], [cats.main]);

  if (loading) return <Center><Spinner /></Center>;
  // a new record needs the create permission of its own section (regular news: news.create)
  if (!isEdit && !can(newsPerm('create', section))) return <Center>{t('adm.noAccess')}</Center>;
  // editing needs the update permission of the record's own section (regular news: news.update)
  if (isEdit && !can(newsPerm('update', section))) return <Center>{t('adm.noAccess')}</Center>;
  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{special ? t(`section.${section}`) : t('adm.news')} — {isEdit ? t('app.edit') : t('app.add')}</h1>
        <Link href={back} className="text-sm text-primary">← {t('app.back')}</Link>
      </div>

      <div className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">
        <div className="md:col-span-2"><Field label={t('f.title')}><input required maxLength={255} className={inputCls} value={f.title} onChange={(e) => set('title', e.target.value)} /></Field></div>
        <div className="md:col-span-2"><Field label={t('f.subject')}><input maxLength={500} className={inputCls} value={f.subject} onChange={(e) => set('subject', e.target.value)} /></Field></div>

        {/* categories */}
        {special ? (
          <Field label={t('f.mainCategory')} hint={t('f.fixed')}>
            <input disabled className={inputCls} value={t(`section.${section}`)} />
          </Field>
        ) : (
          <>
            <Field label={t('f.mainCategory')}>
              {mayChangeCategory ? (
                <>
                  <select required className={inputCls} value={f.mainCategory} onChange={(e) => set('mainCategory', e.target.value)}>
                    <option value="" disabled>—</option>
                    {sectionOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    {f.mainCategory && f.mainCategory !== NEW && !sectionOptions.includes(f.mainCategory) && <option value={f.mainCategory}>{f.mainCategory}</option>}
                    {mayCreateCategory && <option value={NEW}>＋ {t('f.newCategory')}</option>}
                  </select>
                  {f.mainCategory === NEW && <input required maxLength={100} className={`${inputCls} mt-2`} placeholder={t('f.newCategory')} value={f.newMain} onChange={(e) => set('newMain', e.target.value)} />}
                </>
              ) : <input disabled className={inputCls} value={f.mainCategory} />}
            </Field>
            <Field label={t('f.subcategory')}>
              <select className={inputCls} value={f.subcategory} onChange={(e) => set('subcategory', e.target.value)}>
                <option value="">—</option>
                {cats.sub.map((c) => <option key={c} value={c}>{c}</option>)}
                {f.subcategory && f.subcategory !== NEW && !cats.sub.includes(f.subcategory) && <option value={f.subcategory}>{f.subcategory}</option>}
                {mayCreateCategory && <option value={NEW}>＋ {t('f.newCategory')}</option>}
              </select>
              {f.subcategory === NEW && <input required maxLength={100} className={`${inputCls} mt-2`} placeholder={t('f.newCategory')} value={f.newSub} onChange={(e) => set('newSub', e.target.value)} />}
            </Field>
          </>
        )}

        <Field label={t('f.topics')}><input className={inputCls} value={f.topics} onChange={(e) => set('topics', e.target.value)} /></Field>

        {(section === 'TESTIMONIALS') && (
          <Field label={t('f.rating')}>
            <div className="flex items-center gap-3">
              <select className={`${inputCls} max-w-24`} value={f.rating} onChange={(e) => set('rating', e.target.value)}>
                <option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <Stars value={Number(f.rating) || 0} />
            </div>
          </Field>
        )}

        <Field label={t('f.language')}>
          <select className={inputCls} value={f.language} onChange={(e) => set('language', e.target.value)}><option value="ar">{t('l.ar')}</option><option value="en">{t('l.en')}</option></select>
        </Field>
        <Field label={t('f.visibility')}>
          <select className={inputCls} value={f.visibility} onChange={(e) => set('visibility', e.target.value)}><option value="public">{t('v.public')}</option><option value="members">{t('v.members')}</option></select>
        </Field>
        <Field label={t('f.status')}>
          <select className={inputCls} value={f.status} disabled={!mayPublish} onChange={(e) => set('status', e.target.value)}>
            <option value="scheduled">{t('s.scheduled')}</option><option value="published">{t('s.published')}</option>
          </select>
        </Field>
        <Field label={t('f.publishAt')}>
          <input type="datetime-local" className={inputCls} value={f.publishAt} disabled={!mayPublish} required={f.status === 'scheduled'} onChange={(e) => set('publishAt', e.target.value)} />
        </Field>
        {mayFeature && <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={f.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} />{t('f.featured')}</label>}
      </div>

      <div className="rounded-xl border bg-white p-5">
        <div className="mb-2 text-sm font-medium">{t('f.body')}</div>
        <RichEditor key={editorKey} value={f.body} onChange={(h) => set('body', h)} dir={f.language === 'ar' ? 'rtl' : 'ltr'} />
      </div>

      {!special && (
        <div className="rounded-xl border bg-white p-5">
          <Field label={t('f.youtube')} hint={t('f.youtubeHint')} error={ytBad ? t('f.youtubeInvalid') : undefined}>
            <input type="url" dir="ltr" maxLength={255} placeholder="https://www.youtube.com/watch?v=..." className={inputCls} value={f.youtubeUrl} onChange={(e) => set('youtubeUrl', e.target.value)} />
          </Field>
          {ytId && <div className="mx-auto max-w-xl"><YoutubeEmbed id={ytId} title={f.title} /></div>}
        </div>
      )}

      <div className="rounded-xl border bg-white p-5">
        <div className="mb-3 text-sm font-medium">{special ? t('f.images') : t('f.files')}</div>
        <FilePicker label={special ? t('f.addImages') : t('f.addFiles')} hint={special ? t('f.imageHint') : t('f.filesHint')} accept={special ? 'image/jpeg,image/png,image/webp,image/gif' : 'image/jpeg,image/png,image/webp,image/gif,application/pdf,.pdf'} multiple={!single} onChange={addFiles} />
        <div className="mt-4 flex flex-wrap gap-3">
          {existing.map((p) => {
            const gone = removed.has(p);
            return (
              <div key={p} className="relative">
                <img src={urlOf(p)} alt="" onClick={() => setZoom(urlOf(p))} className={`h-24 w-24 cursor-zoom-in rounded-lg border object-cover ${gone ? 'opacity-30' : ''}`} />
                <button type="button" onClick={() => { const n = new Set(removed); gone ? n.delete(p) : n.add(p); setRemoved(n); }} className={`absolute -end-2 -top-2 rounded-full px-1.5 text-xs text-white ${gone ? 'bg-gray-600' : 'bg-red-600'}`} title={gone ? t('f.undo') : t('f.removeImage')}>{gone ? '↺' : '✕'}</button>
              </div>
            );
          })}
          {fresh.map((i, k) => (
            <div key={i.url} className="relative">
              <img src={i.url} alt="" onClick={() => setZoom(i.url)} className="h-24 w-24 cursor-zoom-in rounded-lg border-2 border-emerald-500 object-cover" />
              <span className="absolute bottom-1 start-1 rounded bg-emerald-600 px-1 text-[10px] text-white">{t('f.newImage')}</span>
              <button type="button" onClick={() => { URL.revokeObjectURL(i.url); setFresh(fresh.filter((_, j) => j !== k)); }} className="absolute -end-2 -top-2 rounded-full bg-red-600 px-1.5 text-xs text-white">✕</button>
            </div>
          ))}
          {existing.length + fresh.length === 0 && !pdfFile && !(pdfOld && !special) && <span className="text-sm text-gray-400">—</span>}
        </div>
        {!special && (
          <>
<div className="mt-3 space-y-2 text-sm">
            {pdfFile && (
              <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-emerald-500 px-3 py-2">
                <span className="min-w-0 truncate" dir="ltr">📄 {pdfFile.name} <span className="text-xs text-gray-500">({(pdfFile.size / 1048576).toFixed(1)} MB)</span></span>
                <button type="button" onClick={() => setPdfFile(null)} className="shrink-0 rounded-full bg-red-600 px-1.5 text-xs text-white">✕</button>
              </div>
            )}
            {pdfOld && !pdfFile && (
              <div className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${pdfGone ? 'opacity-40' : ''}`}>
                <a href={urlOf(pdfOld)} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-primary" dir="ltr">📄 {t('f.pdfNote')}</a>
                <button type="button" onClick={() => setPdfGone((g) => !g)} className={`shrink-0 rounded-full px-1.5 text-xs text-white ${pdfGone ? 'bg-gray-600' : 'bg-red-600'}`} title={pdfGone ? t('f.undo') : t('f.removePdf')}>{pdfGone ? '↺' : '✕'}</button>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <Button disabled={busy}>{busy ? t('app.loading') : t('app.save')}</Button>
        <Button type="button" variant="outline" onClick={() => setPreview(true)}>{t('f.preview')}</Button>
        <Link href={back}><Button type="button" variant="ghost">← {t('app.back')}</Button></Link>
      </div>

      <Modal open={!!zoom} onClose={() => setZoom('')} wide><img src={zoom} alt="" className="mx-auto max-h-[75vh] rounded" /></Modal>
      <Modal open={preview} onClose={() => setPreview(false)} wide title={f.title}>
        <div dir={f.language === 'ar' ? 'rtl' : 'ltr'}>
          {f.subject && <p className="mb-3 text-gray-600">{f.subject}</p>}
          <div className="mb-3 flex flex-wrap gap-2">{[...existing.filter((p) => !removed.has(p)).map(urlOf), ...fresh.map((i) => i.url)].map((u) => <img key={u} src={u} alt="" className="h-24 w-32 rounded object-cover" />)}</div>
          {!special && ytId && <YoutubeEmbed id={ytId} title={f.title} />}
          <div className="prose-news mt-4" dangerouslySetInnerHTML={{ __html: f.body }} />
        </div>
      </Modal>
    </form>
  );
}

export default function NewsForm() {
  return <Suspense fallback={<Center><Spinner /></Center>}><Form /></Suspense>;
}
