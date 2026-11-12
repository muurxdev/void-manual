import React, { useEffect, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';

const LIMIT = 84;

/** Puxar de cima para baixo no topo da tela mostra um botão; soltar depois do limite recarrega o app. */
export const PullRefresh: React.FC<{ target: React.RefObject<HTMLElement | null> }> = ({ target }) => {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const down = (e: TouchEvent) => {
      start.current = el.scrollTop <= 0 ? e.touches[0].clientY : null;
    };
    const move = (e: TouchEvent) => {
      if (start.current === null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0 || el.scrollTop > 0) return set(0);
      set(Math.min(dy * 0.5, LIMIT + 24));
    };
    const up = () => {
      const ready = pullRef.current >= LIMIT * 0.75;
      start.current = null;
      if (ready) {
        setBusy(true);
        setPull(LIMIT * 0.75);
        window.setTimeout(() => window.location.reload(), 450);
      } else set(0);
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: true });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }, [target]);

  const ready = pull >= LIMIT * 0.75;
  return (
    <div
      aria-hidden={pull === 0 && !busy}
      className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2"
      style={{ transform: `translate(-50%, ${Math.max(0, pull) - 8}px)`, opacity: Math.min(1, pull / 40), transition: start.current === null ? 'transform 320ms var(--spring), opacity 200ms' : 'none', marginTop: 'env(safe-area-inset-top)' }}
    >
      <span className={`glass flex h-11 w-11 items-center justify-center rounded-full ${ready ? 'glass-ink' : ''}`}>
        <RotateCw className={`h-5 w-5 ${busy ? 'animate-spin' : ''}`} style={{ transform: busy ? undefined : `rotate(${pull * 4}deg)` }} />
      </span>
      <span className="sr-only">{ready ? 'Solte para recarregar' : 'Puxe para recarregar'}</span>
    </div>
  );
};
