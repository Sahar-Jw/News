/**
 * The brand block every footer starts with (main site, DCC EXPO, Women Business Committee): the logo and the name in a medium size,
 * and the short summary under them. The summary is a text the admin edits in Settings for each footer.
 */
export function FooterBrand({ logo, name, summary, className = '' }: { logo?: string | null; name: string; summary?: string | null; className?: string }) {
  if (!logo && !name && !summary) return null;
  return (
    <div className={className}>
      {(logo || name) && (
        <div className="flex items-center gap-3">
          {logo && <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-full bg-white object-contain p-1" />}
          {name && <div className="text-base font-bold leading-snug text-white">{name}</div>}
        </div>
      )}
      {summary && <p className="mt-3 max-w-sm whitespace-pre-line text-sm leading-7 text-white/75">{summary}</p>}
    </div>
  );
}
