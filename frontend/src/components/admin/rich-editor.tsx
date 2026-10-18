'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Modal, inputCls } from '@/components/ui/ui';

/** WYSIWYG editor for news content. The server sanitises HTML on save. */
export function RichEditor({ value, onChange, dir, placeholder }: { value: string; onChange: (html: string) => void; dir: 'rtl' | 'ltr'; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const init = useRef(false);
  const selection = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    if (ref.current && !init.current) {
      ref.current.innerHTML = value || '';
      init.current = true;
    }
  }, [value]);

  const saveSelection = () => {
    const current = window.getSelection();
    if (current?.rangeCount && ref.current?.contains(current.anchorNode)) selection.current = current.getRangeAt(0).cloneRange();
  };
  const restoreSelection = () => {
    if (!selection.current) return;
    const current = window.getSelection();
    current?.removeAllRanges();
    current?.addRange(selection.current);
  };
  const changed = () => {
    onChange(ref.current?.innerHTML ?? '');
    saveSelection();
  };
  const run = (cmd: string, arg?: string) => {
    ref.current?.focus();
    restoreSelection();
    document.execCommand(cmd, false, arg);
    changed();
  };
  const openLink = () => {
    saveSelection();
    const anchor = window.getSelection()?.anchorNode?.parentElement?.closest('a');
    setLinkUrl(anchor?.getAttribute('href') ?? 'https://');
    setLinkOpen(true);
  };
  const applyLink = () => {
    if (!/^(https?:\/\/|mailto:)/i.test(linkUrl.trim())) return;
    run('createLink', linkUrl.trim());
    setLinkOpen(false);
  };
  const clearFormatting = () => {
    if (!ref.current) return;
    ref.current.focus();
    restoreSelection();
    const current = window.getSelection();
    if (!current || current.isCollapsed) {
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      current?.removeAllRanges();
      current?.addRange(range);
    }
    document.execCommand('removeFormat', false);
    document.execCommand('formatBlock', false, 'p');
    changed();
  };
  const B = ({ l, c, a, t }: { l: string; c: string; a?: string; t: string }) => (
    <button type="button" title={t} aria-label={t} onMouseDown={(e) => e.preventDefault()} onClick={() => run(c, a)} className="h-8 min-w-8 rounded px-2 text-sm hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{l}</button>
  );

  return (
    <div className="overflow-hidden rounded-lg border bg-white focus-within:border-primary">
      <div className="flex flex-wrap items-center gap-1 border-b bg-gray-50 p-2" dir="ltr">
        <B l="↶" c="undo" t="Undo" />
        <B l="↷" c="redo" t="Redo" />
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <B l="H2" c="formatBlock" a="h2" t="Heading 2" />
        <B l="H3" c="formatBlock" a="h3" t="Heading 3" />
        <B l="¶" c="formatBlock" a="p" t="Paragraph" />
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <B l="B" c="bold" t="Bold" />
        <B l="I" c="italic" t="Italic" />
        <B l="U" c="underline" t="Underline" />
        <B l="S" c="strikeThrough" t="Strikethrough" />
        <B l="x₂" c="subscript" t="Subscript" />
        <B l="x²" c="superscript" t="Superscript" />
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <B l="•" c="insertUnorderedList" t="Bulleted list" />
        <B l="1." c="insertOrderedList" t="Numbered list" />
        <B l="⇤" c="outdent" t="Decrease indent" />
        <B l="⇥" c="indent" t="Increase indent" />
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <B l="≡" c="justifyLeft" t="Align left" />
        <B l="☰" c="justifyCenter" t="Align center" />
        <B l="≡" c="justifyRight" t="Align right" />
        <B l="❝" c="formatBlock" a="blockquote" t="Quote" />
        <B l="―" c="insertHorizontalRule" t="Horizontal rule" />
        <select aria-label="Font size" title="Font size" defaultValue="3" onMouseDown={saveSelection} onChange={(e) => run('fontSize', e.target.value)} className="h-8 rounded border border-gray-300 bg-white px-1 text-xs">
          <option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">Extra large</option>
        </select>
        <label title="Text color" className="flex h-8 cursor-pointer items-center gap-1 rounded px-1 text-xs hover:bg-gray-200">A<input aria-label="Text color" type="color" defaultValue="#111827" onMouseDown={saveSelection} onChange={(e) => run('foreColor', e.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" /></label>
        <label title="Highlight color" className="flex h-8 cursor-pointer items-center gap-1 rounded px-1 text-xs hover:bg-gray-200">▰<input aria-label="Highlight color" type="color" defaultValue="#fff176" onMouseDown={saveSelection} onChange={(e) => run('hiliteColor', e.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" /></label>
        <B l="🔗" c="unlink" t="Remove link" />
        <button type="button" title="Insert or edit link" aria-label="Insert or edit link" onMouseDown={(e) => e.preventDefault()} onClick={openLink} className="h-8 min-w-8 rounded px-2 text-sm hover:bg-gray-200">↗</button>
        <button type="button" title="Clear formatting" aria-label="Clear formatting" onMouseDown={(e) => e.preventDefault()} onClick={clearFormatting} className="h-8 rounded px-2 text-sm hover:bg-gray-200">Tx</button>
      </div>
      <div
        ref={ref}
        dir={dir}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={changed}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        className="editor prose-news min-h-56 max-h-[28rem] overflow-auto p-3 outline-none"
      />
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title="Insert or edit link">
        <div className="space-y-4">
          <label className="block space-y-1 text-sm font-medium">URL<input autoFocus required type="url" dir="ltr" className={inputCls} placeholder="https://example.com" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} /></label>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button><Button type="button" onClick={applyLink}>Apply link</Button></div>
        </div>
      </Modal>
    </div>
  );
}
