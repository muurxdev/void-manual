import React, { useCallback, useEffect, useRef } from 'react';
import { useSmoothWheel } from '../data/useSmoothWheel';
import { useDockScroll } from './Dock';
import { PullRefresh } from './PullRefresh';


interface PanelBase {
  showBack?: boolean;
  /** o que a seta faz; por padrão fecha a tela */
  onBack?: () => void;
  /** ação principal fixa embaixo; a lista rola inteira acima dela, sem ficar escondida */
  footer?: React.ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}

/* ============================================================
 * ScreenPanel — tela cheia que entra da direita para a esquerda e
 * sai da esquerda para a direita. Também fecha arrastando da borda
 * esquerda para a direita (como nos apps do celular).
 * ========================================================== */
export const ScreenPanel: React.FC<PanelBase> = ({ title, subtitle, onClose, headerExtra, children, showBack = true, onBack, footer }) => {
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const edge = useRef({ on: false, x: 0, y: 0, dx: 0, t: 0, v: 0, lastX: 0, lastT: 0, locked: false });
  useSmoothWheel(body);
  useDockScroll(body);

  const place = (x: number, animate: number) => {
    const el = root.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${animate}ms cubic-bezier(.32, .72, 0, 1)` : 'none';
    el.style.transform = `translate3d(${x}px,0,0)`;
    if (shade.current) {
      const w = el.offsetWidth || window.innerWidth;
      shade.current.style.transition = animate ? `opacity ${animate}ms ease` : 'none';
      shade.current.style.opacity = String(Math.max(0, 1 - x / w) * 0.4);
    }
  };

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    place(root.current?.offsetWidth ?? window.innerWidth, 420);
    window.setTimeout(onClose, 400);
  }, [onClose]);

  // entrada: da direita para a esquerda
  useEffect(() => {
    const w = root.current?.offsetWidth ?? window.innerWidth;
    place(w, 0);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => place(0, 520)));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('void-close-panel', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('void-close-panel', close);
    };
  }, [close]);

  // arrastar da borda esquerda para fechar
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      edge.current = { on: t.clientX < 26, x: t.clientX, y: t.clientY, dx: 0, t: performance.now(), v: 0, lastX: t.clientX, lastT: performance.now(), locked: false };
    };
    const move = (e: TouchEvent) => {
      const s = edge.current;
      if (!s.on || closing.current) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      if (!s.locked) {
        if (Math.abs(t.clientY - s.y) > Math.abs(dx) && Math.abs(t.clientY - s.y) > 8) {
          s.on = false;
          return;
        }
        if (dx > 6) s.locked = true;
        else return;
      }
      if (e.cancelable) e.preventDefault();
      const now = performance.now();
      s.v = (t.clientX - s.lastX) / Math.max(1, now - s.lastT);
      s.lastX = t.clientX;
      s.lastT = now;
      s.dx = Math.max(0, dx);
      place(s.dx, 0);
    };
    const end = () => {
      const s = edge.current;
      if (!s.on || !s.locked) return;
      s.on = false;
      const w = el.offsetWidth || window.innerWidth;
      if (s.dx > w * 0.33 || s.v > 0.6) {
        closing.current = true;
        place(w, 320);
        window.setTimeout(onClose, 300);
      } else {
        place(0, 420);
      }
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: true });
    el.addEventListener('touchcancel', end, { passive: true });
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [onClose]);

  return (
    <>
      <div ref={shade} className="pointer-events-none fixed inset-0 z-40 bg-black" style={{ opacity: 0 }} aria-hidden="true" />
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 z-40 flex flex-col bg-paper"
        style={{ transform: 'translate3d(100%,0,0)', willChange: 'transform', boxShadow: '-24px 0 60px rgba(0,0,0,.18)' }}
      >
        <div className="safe-top mx-auto flex w-full max-w-[760px] items-center justify-between px-[22px] pb-2">
          {showBack ? (
          <button onClick={onBack ?? close} aria-label="Voltar" className="icon-btn glass">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">{headerExtra}</div>
        </div>
        <PullRefresh target={body} />
        <div ref={body} className="scroll-smooth-area min-h-0 flex-1">
          <div className={'mx-auto w-full max-w-[760px] px-[22px] ' + (footer ? 'pb-6' : '[padding-bottom:104px]')}>
            <h1 className="mt-3 text-[clamp(28px,4vw+14px,38px)] font-medium leading-tight tracking-[-0.02em]">{title}</h1>
            {subtitle && <p className="mt-1 text-[14px] text-sub">{subtitle}</p>}
            <div className="mt-5">{children}</div>
          </div>
        </div>
        {footer && (
          <div className="shrink-0 pb-[calc(env(safe-area-inset-bottom)+84px)] pt-3" style={{ background: 'linear-gradient(to top, rgb(var(--paper)) 72%, rgb(var(--paper) / 0))' }}>
            <div className="mx-auto w-full max-w-[760px] px-[22px]">{footer}</div>
          </div>
        )}
      </div>
    </>
  );
};
