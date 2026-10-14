'use client';
import { useEffect, useRef } from 'react';

/** Small WYSIWYG editor (headings, paragraphs, bold, italic, lists, links). The server sanitises on save. */
export function RichEditor({ value, onChange, dir, placeholder }: { value: string; onChange: (html: string) => void; dir: 'rtl' | 'ltr'; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const init = useRef(false);

  useEffect(() => {
    if (ref.current && !init.current) {
      ref.current.innerHTML = value || '';
      init.current = true;
    }
  }, [value]);

  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    onChange(ref.current?.innerHTML ?? '');
  };
  const link = () => {
    const url = prompt('URL (https://…)');
    if (url && /^(https?:\/\/|mailto:)/i.test(url)) run('createLink', url);
  };
  const B = ({ l, c, a, t }: { l: string; c: string; a?: string; t: string }) => (
    <button type="button" title={t} aria-label={t} onMouseDown={(e) => e.preventDefault()} onClick={() => run(c, a)} className="rounded px-2 py-1 text-sm hover:bg-gray-200">{l}</button>
  );

  return (
    <div className="overflow-hidden rounded-lg border bg-white focus-within:border-primary">
      <div className="flex flex-wrap items-center gap-1 border-b bg-gray-50 p-1" dir="ltr">
        <B l="H2" c="formatBlock" a="h2" t="Heading 2" />
        <B l="H3" c="formatBlock" a="h3" t="Heading 3" />
        <B l="¶" c="formatBlock" a="p" t="Paragraph" />
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => run('bold')} className="rounded px-2 py-1 text-sm font-bold hover:bg-gray-200">B</button>
        <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => run('italic')} className="rounded px-2 py-1 text-sm italic hover:bg-gray-200">I</button>
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <B l="• List" c="insertUnorderedList" t="Bullets" />
        <B l="1. List" c="insertOrderedList" t="Numbered" />
        <button type="button" title="Link" onMouseDown={(e) => e.preventDefault()} onClick={link} className="rounded px-2 py-1 text-sm hover:bg-gray-200">🔗</button>
        <B l="✕" c="removeFormat" t="Clear" />
      </div>
      <div
        ref={ref}
        dir={dir}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        className="editor prose-news min-h-56 max-h-[28rem] overflow-auto p-3 outline-none"
      />
    </div>
  );
}
