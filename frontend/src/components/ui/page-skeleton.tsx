/** Placeholder shapes that stand in for a page while it loads (instead of a spinner). Pure CSS, no state. */
const Bar = ({ className = '' }: { className?: string }) => <div className={`skeleton rounded-lg ${className}`} />;

function Body() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-6">
      {/* hero / title */}
      <div className="space-y-3">
        <Bar className="h-8 w-1/3" />
        <Bar className="h-4 w-2/3" />
      </div>
      <Bar className="h-56 w-full rounded-2xl sm:h-72" />
      {/* cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-line bg-white p-3">
            <Bar className="h-36 w-full rounded-xl" />
            <Bar className="h-4 w-4/5" />
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inline skeleton: fills the place of the page content (the header and footer stay where they are). */
export function PageSkeleton({ label }: { label?: string }) {
  return <div role="status" aria-busy="true" aria-label={label}><Body /></div>;
}

/** Full-screen skeleton shown while moving between pages (it replaces the old full-screen spinner). */
export function PageSkeletonOverlay({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-canvas" role="status" aria-live="polite" aria-busy="true" aria-label={label}>
      <div className="h-14 border-b border-line bg-white/80 px-4">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
          <Bar className="h-7 w-32" />
          <div className="hidden gap-3 sm:flex"><Bar className="h-4 w-16" /><Bar className="h-4 w-16" /><Bar className="h-4 w-16" /><Bar className="h-4 w-16" /></div>
        </div>
      </div>
      <Body />
    </div>
  );
}
