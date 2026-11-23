'use client';
import { useEffect, useRef, useState } from 'react';
import { inputCls } from '@/components/ui/ui';

/** stored HTML -> the plain text shown in the box (paragraphs and line breaks become new lines, list items start with a bullet) */
export const htmlToText = (h: string) => (h ?? '')
  .replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote)>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\n{3,}/g, '\n\n').trim();

/** the typed text -> simple HTML paragraphs (a blank line starts a new paragraph), as the public pages show it */
export const textToHtml = (t: string) => t.trim() === '' ? '' : t.trim().split(/\n{2,}/).map((para) => `<p>${para.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`).join('');

/**
 * A normal text box instead of the rich editor: fixed height, it cannot be resized and it scrolls when there is a lot of text.
 * Same props as RichEditor (the value is stored as HTML), so it can replace it anywhere. The rich editor stays only in the news forms and the About page.
 * A value that is never edited is left exactly as stored; once it is edited its formatting (bold, links ...) becomes plain paragraphs.
 */
export function PlainEditor({ value, onChange, dir, placeholder, rows = 5 }: { value: string; onChange: (html: string) => void; dir: 'rtl' | 'ltr'; placeholder?: string; rows?: number }) {
  const [text, setText] = useState(() => htmlToText(value));
  const sent = useRef(value);
  useEffect(() => {
    if (value !== sent.current) { sent.current = value; setText(htmlToText(value)); } // changed from outside (another record loaded)
  }, [value]);
  return (
    <textarea
      dir={dir}
      rows={rows}
      placeholder={placeholder}
      value={text}
      onChange={(e) => { const html = textToHtml(e.target.value); sent.current = html; setText(e.target.value); onChange(html); }}
      className={`${inputCls} h-36 resize-none overflow-y-auto`}
    />
  );
}
