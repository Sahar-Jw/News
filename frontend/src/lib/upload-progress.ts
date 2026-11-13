/** Progress of the files being uploaded (api() reports it, <UploadProgress /> shows it). */
export interface UploadState { active: number; loaded: number; total: number }
const uploads = new Map<number, { loaded: number; total: number }>();
const listeners = new Set<(s: UploadState) => void>();
let next = 1;

const snapshot = (): UploadState => {
  let loaded = 0, total = 0;
  uploads.forEach((u) => { loaded += u.loaded; total += u.total; });
  return { active: uploads.size, loaded, total };
};
const emit = () => { const s = snapshot(); listeners.forEach((l) => l(s)); };

export function startUpload(total: number): number {
  const id = next++;
  uploads.set(id, { loaded: 0, total: Math.max(1, total) });
  emit();
  return id;
}
export function updateUpload(id: number, loaded: number) {
  const u = uploads.get(id);
  if (u) { u.loaded = Math.min(loaded, u.total); emit(); }
}
export function endUpload(id: number) { if (uploads.delete(id)) emit(); }
export function subscribeToUploads(cb: (s: UploadState) => void) {
  listeners.add(cb);
  cb(snapshot());
  return () => { listeners.delete(cb); };
};
