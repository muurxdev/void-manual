import { flushSync } from 'react-dom';

export type NavKind = 'forward' | 'back' | 'rise';

/** Troca de estado com transição nativa (View Transitions); sem suporte, troca direta. */
export function transition(kind: NavKind, update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  document.documentElement.dataset.nav = kind;
  doc.startViewTransition(() => flushSync(update));
}
