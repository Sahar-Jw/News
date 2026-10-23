'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Modal, inputCls } from '@/components/ui/ui';

/** Small stroke icons (24x24 grid) so every toolbar button is readable without extra dependencies. */
const ICONS: Record<string, React.ReactNode> = {
  undo: <><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></>,
  redo: <><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" /></>,
  bold: <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />,
  italic: <><line x1="19" x2="10" y1="4" y2="4" /><line x1="14" x2="5" y1="20" y2="20" /><line x1="15" x2="9" y1="4" y2="20" /></>,
  underline: <><path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="4" x2="20" y1="20" y2="20" /></>,
  strike: <><path d="M16 4H9a3 3 0 0 0-2.83 4" /><path d="M14 12a4 4 0 0 1 0 8H6" /><line x1="4" x2="20" y1="12" y2="12" /></>,
  ul: <><line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" /><line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" /></>,
  ol: <><line x1="10" x2="21" y1="6" y2="6" /><line x1="10" x2="21" y1="12" y2="12" /><line x1="10" x2="21" y1="18" y2="18" /><path d="M4 6h1v4" /><path d="M4 10h2" /><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></>,
  indent: <><polyline points="3 8 7 12 3 16" /><line x1="21" x2="11" y1="12" y2="12" /><line x1="21" x2="11" y1="6" y2="6" /><line x1="21" x2="11" y1="18" y2="18" /></>,
  outdent: <><polyline points="7 8 3 12 7 16" /><line x1="21" x2="11" y1="12" y2="12" /><line x1="21" x2="11" y1="6" y2="6" /><line x1="21" x2="11" y1="18" y2="18" /></>,
  left: <><line x1="21" x2="3" y1="6" y2="6" /><line x1="15" x2="3" y1="12" y2="12" /><line x1="17" x2="3" y1="18" y2="18" /></>,
  center: <><line x1="21" x2="3" y1="6" y2="6" /><line x1="17" x2="7" y1="12" y2="12" /><line x1="19" x2="5" y1="18" y2="18" /></>,
  right: <><line x1="21" x2="3" y1="6" y2="6" /><line x1="21" x2="9" y1="12" y2="12" /><line x1="21" x2="7" y1="18" y2="18" /></>,
  quote: <><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></>,
  hr: <line x1="4" x2="20" y1="12" y2="12" />,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  unlink: <><path d="M9 17H7A5 5 0 0 1 7 7" /><path d="M15 7h2a5 5 0 0 1 4 8" /><line x1="8" x2="12" y1="12" y2="12" /><line x1="2" x2="22" y1="2" y2="22" /></>,
  trash: <><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></>,
  eraser: <><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></>,
};
const Icon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
);

/** Commands whose on/off state the browser can report for the current selection. */
const STATE_CMDS = ['bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript', 'insertUnorderedList', 'insertOrderedList', 'justifyLeft', 'justifyCenter', 'justifyRight'];
const BTN = 'flex h-8 min-w-8 items-center justify-center rounded px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const ON = 'bg-primary text-white';
const OFF = 'hover:bg-gray-200';

/** WYSIWYG editor for news content. The server sanitises HTML on save. */
export function RichEditor({ value, onChange, dir, placeholder }: { value: string; onChange: (html: string) => void; dir: 'rtl' | 'ltr'; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const init = useRef(false);
  const selection = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [inLink, setInLink] = useState(false);

  useEffect(() => {
    if (ref.current && !init.current) {
      ref.current.innerHTML = value || '';
      init.current = true;
    }
  }, [value]);

  /** Which formatting is active at the caret / selection (drives the highlighted toolbar buttons). */
  const refreshActive = () => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel?.rangeCount || !el.contains(sel.anchorNode)) return;
    const next: Record<string, boolean> = {};
    for (const c of STATE_CMDS) {
      try { next[c] = document.queryCommandState(c); } catch { next[c] = false; }
    }
    try {
      const block = String(document.queryCommandValue('formatBlock') || '').toLowerCase().replace(/[<>]/g, '');
      next[`formatBlock:${block}`] = true;
    } catch { /* ignore */ }
    setActive(next);
    const node = sel.anchorNode;
    const start = node && node.nodeType === 3 ? node.parentElement : (node as Element | null);
    setInLink(!!start?.closest('a') && el.contains(start));
  };
  useEffect(() => {
    document.addEventListener('selectionchange', refreshActive);
    return () => document.removeEventListener('selectionchange', refreshActive);
  }, []);

  /** Pasted HTML keeps its structure but loses background colours / highlights (they showed up as yellow patches). */
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData.getData('text/html');
    if (!html) return; // plain text: the browser handles it
    e.preventDefault();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.body.querySelectorAll<HTMLElement>('*').forEach((el) => {
      el.style.removeProperty('background');
      el.style.removeProperty('background-color');
      el.style.removeProperty('background-image');
      el.removeAttribute('bgcolor');
      if (!el.getAttribute('style')?.trim()) el.removeAttribute('style');
    });
    doc.body.querySelectorAll('mark').forEach((m) => m.replaceWith(...Array.from(m.childNodes)));
    document.execCommand('insertHTML', false, doc.body.innerHTML);
    changed();
  };

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
    refreshActive();
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

  /** Deletes the whole content. Goes through the browser's edit history, so Undo brings it back. */
  const clearAll = () => {
    if (!ref.current) return;
    ref.current.focus();
    const range = document.createRange();
    range.selectNodeContents(ref.current);
    const current = window.getSelection();
    current?.removeAllRanges();
    current?.addRange(range);
    selection.current = range.cloneRange();
    document.execCommand('delete', false);
    changed();
  };

  /** One toolbar button. `on` highlights it; clicking an active block button (H2, H3, quote) turns it back into a paragraph. */
  const btn = (key: string, content: React.ReactNode, title: string, onClick: () => void, on = false, disabled = false) => (
    <button key={key} type="button" title={title} aria-label={title} aria-pressed={on} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`${BTN} ${on ? ON : OFF} ${disabled ? 'cursor-not-allowed opacity-40 hover:bg-transparent' : ''}`}>{content}</button>
  );
  const cmd = (key: string, content: React.ReactNode, title: string, c: string) => btn(key, content, title, () => run(c), !!active[c]);
  const block = (key: string, content: React.ReactNode, title: string, tag: string) => {
    const on = !!active[`formatBlock:${tag}`];
    return btn(key, content, title, () => run('formatBlock', on ? 'p' : tag), on);
  };
  const sep = (k: string) => <span key={k} className="mx-1 h-5 w-px bg-gray-300" />;

  return (
    <div className="overflow-hidden rounded-lg border bg-white focus-within:border-primary">
      <div className="flex flex-wrap items-center gap-1 border-b bg-gray-50 p-2" dir="ltr">
        {btn('undo', <Icon name="undo" />, 'Undo', () => run('undo'))}
        {btn('redo', <Icon name="redo" />, 'Redo', () => run('redo'))}
        {sep('s1')}
        {block('h2', 'H2', 'Heading 2', 'h2')}
        {block('h3', 'H3', 'Heading 3', 'h3')}
        {btn('p', '¶', 'Paragraph', () => run('formatBlock', 'p'))}
        {sep('s2')}
        {cmd('bold', <Icon name="bold" />, 'Bold', 'bold')}
        {cmd('italic', <Icon name="italic" />, 'Italic', 'italic')}
        {cmd('underline', <Icon name="underline" />, 'Underline', 'underline')}
        {cmd('strike', <Icon name="strike" />, 'Strikethrough', 'strikeThrough')}
        {cmd('sub', 'x₂', 'Subscript', 'subscript')}
        {cmd('sup', 'x²', 'Superscript', 'superscript')}
        {sep('s3')}
        {cmd('ul', <Icon name="ul" />, 'Bulleted list', 'insertUnorderedList')}
        {cmd('ol', <Icon name="ol" />, 'Numbered list', 'insertOrderedList')}
        {btn('outdent', <Icon name="outdent" />, 'Decrease indent', () => run('outdent'))}
        {btn('indent', <Icon name="indent" />, 'Increase indent', () => run('indent'))}
        {sep('s4')}
        {cmd('left', <Icon name="left" />, 'Align left', 'justifyLeft')}
        {cmd('center', <Icon name="center" />, 'Align center', 'justifyCenter')}
        {cmd('right', <Icon name="right" />, 'Align right', 'justifyRight')}
        {block('quote', <Icon name="quote" />, 'Quote', 'blockquote')}
        {btn('hr', <Icon name="hr" />, 'Horizontal rule', () => run('insertHorizontalRule'))}
        <select aria-label="Font size" title="Font size" defaultValue="3" onMouseDown={saveSelection} onChange={(e) => run('fontSize', e.target.value)} className="h-8 rounded border border-gray-300 bg-white px-1 text-xs">
          <option value="2">Small</option><option value="3">Normal</option><option value="4">Large</option><option value="5">Extra large</option>
        </select>
        <label title="Text color" className="flex h-8 cursor-pointer items-center gap-1 rounded px-1 text-xs hover:bg-gray-200">A<input aria-label="Text color" type="color" defaultValue="#111827" onMouseDown={saveSelection} onChange={(e) => run('foreColor', e.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" /></label>
        <label title="Highlight color" className="flex h-8 cursor-pointer items-center gap-1 rounded px-1 text-xs hover:bg-gray-200">▰<input aria-label="Highlight color" type="color" defaultValue="#fff176" onMouseDown={saveSelection} onChange={(e) => run('hiliteColor', e.target.value)} className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" /></label>
        {sep('s5')}
        {btn('link', <Icon name="link" />, 'Insert or edit link', openLink, inLink)}
        {btn('unlink', <Icon name="unlink" />, 'Remove link', () => run('unlink'), false, !inLink)}
        {btn('clear', <Icon name="eraser" />, 'Clear formatting', clearFormatting)}
        {btn('clearAll', <Icon name="trash" />, 'Clear all content', clearAll)}
      </div>
      <div
        ref={ref}
        dir={dir}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={changed}
        onPaste={onPaste}
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
