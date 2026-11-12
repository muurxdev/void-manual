import { useEffect, type RefObject } from 'react';

/**
 * Suaviza a roda do mouse (inércia por interpolação). Trackpads e toque já têm inércia
 * nativa, então só interceptamos deltas "de roda" em ponteiro fino.
 */
export function useSmoothWheel(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let target = el.scrollTop;
    let raf = 0;

    const max = () => el.scrollHeight - el.clientHeight;
    const tick = () => {
      const diff = target - el.scrollTop;
      if (Math.abs(diff) < 0.5) {
        el.scrollTop = target;
        raf = 0;
        return;
      }
      el.scrollTop += diff * 0.14;
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      // trackpad costuma gerar deltas pequenos/fracionados; roda gera passos grandes e inteiros
      const wheelLike = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
      if (!wheelLike || e.ctrlKey) return;
      e.preventDefault();
      if (!raf) target = el.scrollTop;
      target = Math.max(0, Math.min(max(), target + e.deltaY * (e.deltaMode === 1 ? 32 : 1)));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const sync = () => {
      if (!raf) target = el.scrollTop;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', sync, { passive: true });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', sync);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
}
