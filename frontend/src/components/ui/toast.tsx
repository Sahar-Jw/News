'use client';
import { createContext, useCallback, useContext, useState } from 'react';

type Kind = 'ok' | 'err';
const Ctx = createContext<(msg: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: Kind }[]>([]);
  const push = useCallback((msg: string, kind: Kind = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 start-4 z-[100] flex max-w-sm flex-col gap-2" role="status" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${i.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {i.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
