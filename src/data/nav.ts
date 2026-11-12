import { flushSync } from 'react-dom';

export type NavKind = 'forward' | 'back' | 'rise';

/** Último toque na tela: as telas abrem expandindo daqui e voltam para cá. */
let tap = { x: innerWidth / 2, y: innerHeight * 0.8 };
const origins: { x: number; y: number }[] = [];
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      tap = { x: e.clientX, y: e.clientY };
    },
    { capture: true, passive: true }
  );
}

/** Troca de estado com transição nativa (View Transitions); sem suporte, troca direta. */
export function transition(kind: NavKind, update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  let o = tap;
  if (kind === 'forward') origins.push(tap);
  else if (kind === 'back') o = origins.pop() ?? tap;
  const root = document.documentElement;
  root.style.setProperty('--nx', Math.round(o.x) + 'px');
  root.style.setProperty('--ny', Math.round(o.y) + 'px');
  root.dataset.nav = kind;
  doc.startViewTransition(() => flushSync(update));
}
