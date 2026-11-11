import { useEffect, useRef } from 'react';

/** Fired after a news item was saved from the "add news" window, so the page behind it can reload its list. */
export const NEWS_SAVED_EVENT = 'news:saved';

export const announceNewsSaved = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NEWS_SAVED_EVENT));
};

/** Runs `cb` every time a news item is saved from the "add news" window. */
export function useNewsSaved(cb: () => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const h = () => ref.current();
    window.addEventListener(NEWS_SAVED_EVENT, h);
    return () => window.removeEventListener(NEWS_SAVED_EVENT, h);
  }, []);
}
