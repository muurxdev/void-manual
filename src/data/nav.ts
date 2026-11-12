export type NavKind = 'forward' | 'back' | 'rise';

/** Último toque: as telas cheias crescem daqui e encolhem de volta para cá. */
let tap = { x: window.innerWidth / 2, y: window.innerHeight * 0.85 };
const origins: { x: number; y: number }[] = [];
window.addEventListener(
  'pointerdown',
  (e) => {
    tap = { x: e.clientX, y: e.clientY };
  },
  { capture: true, passive: true }
);

let pending = 0;

/**
 * Troca de tela sem View Transitions (elas piscavam).
 * - forward: troca já; a tela nova se anima sozinha (classe screen-in) a partir do toque.
 * - back: a tela atual encolhe para o ponto de origem e só então sai.
 */
export function transition(kind: NavKind, update: () => void) {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let o = tap;
  if (kind === 'forward') origins.push(tap);
  else if (kind === 'back') o = origins.pop() ?? tap;
  root.style.setProperty('--ox', Math.round(o.x) + 'px');
  root.style.setProperty('--oy', Math.round(o.y) + 'px');
  const el = kind === 'back' && !reduce ? document.querySelector('[data-screen]') : null;
  if (!el) {
    update();
    return;
  }
  el.classList.remove('screen-in');
  el.classList.add('screen-out');
  window.clearTimeout(pending);
  pending = window.setTimeout(update, 230);
}
