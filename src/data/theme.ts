import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
const KEY = 'void_web_theme';

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
const resolve = (c: ThemeChoice) => (c === 'system' ? (systemDark() ? 'dark' : 'light') : c);

function apply(c: ThemeChoice) {
  const t = resolve(c);
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#000000' : '#FFFFFF');
}

/** Tema claro/escuro/sistema, persistido, com transição suave via View Transitions. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    try {
      return (localStorage.getItem(KEY) as ThemeChoice) || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    apply(choice);
    if (choice !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => apply('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [choice]);

  const set = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* sem storage */
    }
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.dataset.nav = 'theme';
      doc.startViewTransition(() => {
        apply(next);
        setChoice(next);
      });
    } else {
      setChoice(next);
    }
  }, []);

  const resolved = resolve(choice);
  const toggle = useCallback(() => set(resolved === 'dark' ? 'light' : 'dark'), [resolved, set]);
  return { choice, resolved, set, toggle };
}

/** Marca no <html> se o navegador renderiza a refração de lente do Liquid Glass. */
export function detectLens() {
  try {
    const ua = navigator.userAgent;
    const chromium = /Chrome\/|Chromium\//.test(ua) && !/CriOS|FxiOS/.test(ua);
    const strong = (navigator.hardwareConcurrency || 4) >= 4;
    const calm = !window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
    const touch = window.matchMedia('(pointer: coarse)').matches; // celular: a lente pesa e trava a rolagem
    if (chromium && strong && calm && !touch && CSS.supports('backdrop-filter', 'url(#lg-lens) blur(1px)')) {
      document.documentElement.dataset.lens = '1';
    }
  } catch {
    /* mantém só o blur */
  }
}
