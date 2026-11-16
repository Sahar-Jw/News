import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_RECORD, MAX_PDF_BYTES, MAX_PDFS_PER_RECORD } from './constants';

const MB = 1024 * 1024;

/** The upload limits the dashboard can change (Settings -> Upload limits). `min` / `max` are what a value may be set to. */
export const UPLOAD_LIMIT_DEFS = {
  image_max_mb: { def: MAX_IMAGE_BYTES / MB, min: 1, max: 50 },
  pdf_max_mb: { def: MAX_PDF_BYTES / MB, min: 1, max: 100 },
  max_images: { def: MAX_IMAGES_PER_RECORD, min: 1, max: 100 },
  max_pdfs: { def: MAX_PDFS_PER_RECORD, min: 1, max: 50 },
} as const;
export type UploadLimitKey = keyof typeof UPLOAD_LIMIT_DEFS;
export const UPLOAD_LIMITS_CATEGORY = 'uploads';

/**
 * The limits in force right now. One shared object, changed in place when the settings are saved (and re-read every minute for other
 * server copies), so the upload handlers and the services always read the current values: use these instead of the MAX_* constants.
 */
export const uploadLimits = {
  imageBytes: MAX_IMAGE_BYTES,
  pdfBytes: MAX_PDF_BYTES,
  imagesPerRecord: MAX_IMAGES_PER_RECORD,
  pdfsPerRecord: MAX_PDFS_PER_RECORD,
  /** the biggest single file a form may carry: forms that take both pictures and PDFs let this through the door, then each file is checked against its own limit */
  get maxBytes() { return Math.max(this.imageBytes, this.pdfBytes); },
  get imageMb() { return Math.round((this.imageBytes / MB) * 100) / 100; },
  get pdfMb() { return Math.round((this.pdfBytes / MB) * 100) / 100; },
};

/** a stored value -> a usable one (empty or out of range = the default) */
export function cleanLimit(key: UploadLimitKey, raw: unknown): number {
  const d = UPLOAD_LIMIT_DEFS[key];
  const n = Number(raw);
  return Number.isFinite(n) && n >= d.min && n <= d.max ? n : d.def;
}

export function applyUploadLimits(values: Partial<Record<UploadLimitKey, unknown>>) {
  uploadLimits.imageBytes = Math.round(cleanLimit('image_max_mb', values.image_max_mb) * MB);
  uploadLimits.pdfBytes = Math.round(cleanLimit('pdf_max_mb', values.pdf_max_mb) * MB);
  uploadLimits.imagesPerRecord = Math.floor(cleanLimit('max_images', values.max_images));
  uploadLimits.pdfsPerRecord = Math.floor(cleanLimit('max_pdfs', values.max_pdfs));
}
