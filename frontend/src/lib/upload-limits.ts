/**
 * The upload limits chosen in Settings -> Upload limits (the API enforces them; the forms use them to warn before a file is sent).
 * One shared object: the site provider fills it as soon as the settings arrive, and the forms read it when a file is picked.
 * Texts in the dictionary use the placeholders {imageMb} {pdfMb} {maxImages} {maxPdfs}; `fillLimits` swaps them for the current values.
 */
export const UL = {
  imageMb: 5,
  pdfMb: 25,
  maxImages: 100,
  maxPdfs: 10,
  get imageBytes() { return this.imageMb * 1024 * 1024; },
  get pdfBytes() { return this.pdfMb * 1024 * 1024; },
};

let version = 0;
const listeners = new Set<() => void>();
/** changes every time a limit really changes (lets the translation function re-render the texts that mention a limit) */
export const limitsVersion = () => version;
export function subscribeLimits(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function applyUploadLimits(v?: Record<string, unknown> | null) {
  const n = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : d);
  const next = {
    imageMb: n(v?.image_max_mb, 5),
    pdfMb: n(v?.pdf_max_mb, 25),
    maxImages: Math.floor(n(v?.max_images, 100)),
    maxPdfs: Math.floor(n(v?.max_pdfs, 10)),
  };
  const changed = next.imageMb !== UL.imageMb || next.pdfMb !== UL.pdfMb || next.maxImages !== UL.maxImages || next.maxPdfs !== UL.maxPdfs;
  Object.assign(UL, next);
  if (changed) { version += 1; listeners.forEach((f) => f()); }
}

/** replaces {imageMb} {pdfMb} {maxImages} {maxPdfs} in a text with the limits currently set */
export function fillLimits(text: string) {
  return text.includes('{') ? text.replace(/\{(imageMb|pdfMb|maxImages|maxPdfs)\}/g, (_, k: 'imageMb' | 'pdfMb' | 'maxImages' | 'maxPdfs') => String(UL[k])) : text;
}
