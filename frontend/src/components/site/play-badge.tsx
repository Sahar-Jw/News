/** Round play button laid over the cover of a video (the parent must be `relative` and `group`). */
export function PlayBadge({ small = false }: { small?: boolean }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className={`flex items-center justify-center rounded-full bg-black/55 text-white shadow-lift ring-2 ring-white/70 transition group-hover:scale-110 group-hover:bg-primary/90 ${small ? 'h-9 w-9' : 'h-14 w-14'}`}>
        <svg viewBox="0 0 24 24" className={small ? 'h-4 w-4' : 'h-6 w-6'} fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>
    </span>
  );
}
