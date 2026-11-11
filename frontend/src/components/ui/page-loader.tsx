function Loader({ label, className }: { label?: string; className: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
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
  return <Loader label={label} className="min-h-[50vh] w-full" />;
}

/** Full-screen loader shown while navigating to another page. */
export function PageLoaderOverlay({ label }: { label?: string }) {
  return <Loader label={label} className="fixed inset-0 z-[200] min-h-screen overflow-hidden bg-canvas" />;
}
