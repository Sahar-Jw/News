/**
 * The upload limits chosen in Settings -> Upload limits (the API enforces them; the forms use them to warn before a file is sent).
 * One shared object: the site provider fills it as soon as the settings arrive, and the forms read it when a file is picked.
 */
export const UL = {
  imageMb: 5,
  pdfMb: 25,
  maxImages: 100,
  maxPdfs: 10,
  get imageBytes() { return this.imageMb * 1024 * 1024; },
  get pdfBytes() { return this.pdfMb * 1024 * 1024; },
};

export function applyUploadLimits(v?: Record<string, unknown> | null) {
  const n = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : d);
  UL.imageMb = n(v?.image_max_mb, 5);
  UL.pdfMb = n(v?.pdf_max_mb, 25);
  UL.maxImages = Math.floor(n(v?.max_images, 100));
  UL.maxPdfs = Math.floor(n(v?.max_pdfs, 10));
}
