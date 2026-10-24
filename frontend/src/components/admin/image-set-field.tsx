'use client';
import { useEffect, useRef } from 'react';
import { fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { FilePicker } from '@/components/ui/ui';
import { useToast } from '@/components/ui/toast';

export const MAX_IMAGES = 20;
export interface SavedImage { path: string; url: string }
export interface NewImage { file: File; url: string }
/** The pictures of one record while it is edited: saved ones (can be removed) + newly chosen files. */
export interface ImageSet { saved: SavedImage[]; removed: string[]; fresh: NewImage[] }

export const emptyImageSet = (): ImageSet => ({ saved: [], removed: [], fresh: [] });
export const imageSetOf = (paths: string[] = [], urls: string[] = []): ImageSet => ({ saved: paths.map((path, i) => ({ path, url: urls[i] })), removed: [], fresh: [] });
export const imageTotal = (s: ImageSet) => s.saved.filter((x) => !s.removed.includes(x.path)).length + s.fresh.length;
export const releaseImages = (s: ImageSet) => s.fresh.forEach((f) => URL.revokeObjectURL(f.url));

/** Appends the multipart fields: new files as "images", and (edit) the saved pictures to keep as "keepImages". */
export function appendImages(fd: FormData, s: ImageSet, edit: boolean) {
  s.fresh.forEach((f) => fd.append('images', f.file));
  if (edit) fd.append('keepImages', JSON.stringify(s.saved.filter((x) => !s.removed.includes(x.path)).map((x) => x.path)));
}

export function ImageSetField({ value, onChange }: { value: ImageSet; onChange: (v: ImageSet) => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const latest = useRef(value);
  latest.current = value;
  // object URLs of files still chosen when the form closes are released
  useEffect(() => () => releaseImages(latest.current), []);

  const add = (list: FileList | null) => {
    if (!list) return;
    const files = [...list].filter((f) => f.type.startsWith('image/'));
    const room = MAX_IMAGES - imageTotal(value);
    if (files.length > room) toast(t('oc.tooMany'), 'err');
    const take = files.slice(0, Math.max(0, room));
    if (take.length) onChange({ ...value, fresh: [...value.fresh, ...take.map((file) => ({ file, url: URL.createObjectURL(file) }))] });
  };
  const dropSaved = (path: string) => onChange({ ...value, removed: [...value.removed, path] });
  const dropFresh = (i: number) => {
    URL.revokeObjectURL(value.fresh[i].url);
    onChange({ ...value, fresh: value.fresh.filter((_, n) => n !== i) });
  };
  const savedShown = value.saved.filter((x) => !value.removed.includes(x.path));
  const btn = 'absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white hover:bg-red-600';

  return (
    <div className="space-y-3">
      <FilePicker label={t('oc.addImages')} hint={t('oc.imagesHint')} accept="image/*" multiple onChange={add} />
      {(savedShown.length > 0 || value.fresh.length > 0) && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {savedShown.map((x) => (
            <div key={x.path} className="relative aspect-[4/3] overflow-hidden rounded border bg-gray-100">
              <img src={fileUrl(x.url)} alt="" className="h-full w-full object-cover" />
              <button type="button" className={btn} aria-label={t('oc.removeImage')} onClick={() => dropSaved(x.path)}>✕</button>
            </div>
          ))}
          {value.fresh.map((x, i) => (
            <div key={x.url} className="relative aspect-[4/3] overflow-hidden rounded border-2 border-primary/40 bg-gray-100">
              <img src={x.url} alt="" className="h-full w-full object-cover" />
              <button type="button" className={btn} aria-label={t('oc.removeImage')} onClick={() => dropFresh(i)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
