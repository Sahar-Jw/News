export default function Loading() {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white/85 backdrop-blur-sm" role="status" aria-label="Loading page">
      <span className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" aria-hidden="true" />
    </div>
  );
}
