'use client';
import { useEffect, useRef, useState } from 'react';
import { fileUrl } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

/**
 * PDF preview drawn with pdf.js onto canvases. An <iframe>/<embed> does not work on phones (iOS shows only the
 * first page, Android Chrome offers a download instead), so pages are rendered by script: same result everywhere.
 * Pages render lazily when they come near the viewport, at the width of the box, so long files stay light.
 */
type PdfDoc = import('pdfjs-dist').PDFDocumentProxy;

/** Canvas pixel budget per page (iOS Safari refuses canvases above ~16.7M pixels). */
const MAX_PIXELS = 12_000_000;

function PdfPage({ doc, n, width }: { doc: PdfDoc; n: number; width: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(1.414); // height / width, A4 until the real page is known
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || width < 50) return;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let dead = false;
    (async () => {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      if (dead) return;
      setRatio(base.height / base.width);
      const cssScale = width / base.width;
      let os = Math.min(window.devicePixelRatio || 1, 2);
      while (os > 1 && base.width * cssScale * os * base.height * cssScale * os > MAX_PIXELS) os -= 0.25;
      const vp = page.getViewport({ scale: cssScale * os });
      const c = canvas.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      task = page.render({ canvasContext: ctx, viewport: vp });
      await task.promise;
    })().catch(() => { /* cancelled by a resize or unmount */ });
    return () => { dead = true; task?.cancel(); };
  }, [doc, n, width, visible]);

  return (
    <div ref={holder} className="mx-auto overflow-hidden bg-white shadow ring-1 ring-black/5" style={{ width, height: Math.round(width * ratio) }}>
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}

export function PdfViewer({ src, title }: { src: string; title: string }) {
  const { t } = useI18n();
  const url = fileUrl(src);
  const box = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [state, setState] = useState<'load' | 'ok' | 'err'>('load');
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let dead = false;
    let loaded: PdfDoc | null = null;
    setState('load');
    (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
      const res = await fetch(url); // plain GET (no Range header) so no CORS preflight is needed
      if (!res.ok) throw new Error(String(res.status));
      const data = new Uint8Array(await res.arrayBuffer());
      loaded = await pdfjs.getDocument({ data }).promise;
      if (dead) { void loaded.destroy(); return; }
      setDoc(loaded);
      setState('ok');
    })().catch(() => { if (!dead) setState('err'); });
    return () => { dead = true; void loaded?.destroy(); };
  }, [url]);

  // follow the box width (rotation, window resize); rounded so tiny changes do not redraw every page
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(0, Math.floor((el.clientWidth - 16) / 8) * 8));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [state]);

  return (
    <section className="mt-8" aria-label={t('site.pdf')}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">
          {t('site.pdf')}
          {doc && <span className="ms-2 text-xs font-normal text-gray-500">{doc.numPages} {t('site.pdfPages')}</span>}
        </h2>
        <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary hover:text-white">{t('site.openPdf')} ↗</a>
      </div>
      <div ref={box} className="max-h-[80vh] overflow-y-auto rounded-2xl bg-gray-100 p-2" dir="ltr" aria-label={title}>
        {state === 'load' && <div className="py-16 text-center text-sm text-gray-500">{t('app.loading')}</div>}
        {state === 'err' && (
          <div className="py-12 text-center text-sm text-gray-600">
            {t('site.pdfError')} — <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{t('site.openPdf')}</a>
          </div>
        )}
        {state === 'ok' && doc && width > 0 && (
          <div className="space-y-3">{Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} n={i + 1} width={width} />)}</div>
        )}
      </div>
    </section>
  );
}
