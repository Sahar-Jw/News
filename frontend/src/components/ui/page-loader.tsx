/** `delay` (ms): the loader stays invisible this long, so a page / data that arrives quickly never flashes a spinner. */
function Loader({ label, className, delay = 0 }: { label?: string; className: string; delay?: number }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}${delay ? ' late-in' : ''}`}
      style={delay ? ({ '--late': `${delay}ms` } as React.CSSProperties) : undefined}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary/15 border-t-primary" aria-hidden="true" />
      {label && <span className="text-sm font-medium text-gray-600">{label}</span>}
    </div>
  );
}

/** Inline loader for page content that is waiting for data. */
export function PageLoader({ label }: { label?: string }) {
  return <Loader label={label} className="min-h-[50vh] w-full" delay={400} />;
}

/** Full-screen loader shown while navigating to another page. */
/** `delay` defaults to 700ms: the route-level loading screen only shows when the page is really late. */
export function PageLoaderOverlay({ label, delay = 700 }: { label?: string; delay?: number }) {
  return <Loader label={label} className="fixed inset-0 z-[200] min-h-screen overflow-hidden bg-canvas" delay={delay} />;
}
