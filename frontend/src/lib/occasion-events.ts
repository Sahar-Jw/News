import { useEffect, useRef } from 'react';

/** Fired after an exhibition / occasion was added, edited or deleted from a window on a public page, so the lists behind it reload. */
export const OCCASIONS_CHANGED_EVENT = 'occasions:changed';

export const announceOccasionsChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OCCASIONS_CHANGED_EVENT));
};

/** Runs `cb` every time an exhibition / occasion changed. */
export function useOccasionsChanged(cb: () => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const h = () => ref.current();
    window.addEventListener(OCCASIONS_CHANGED_EVENT, h);
    return () => window.removeEventListener(OCCASIONS_CHANGED_EVENT, h);
  }, []);
}
