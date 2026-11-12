import React, { useEffect, useRef } from 'react';

interface DustProps {
  dark: boolean;
  /** 0..1 */
  intensity?: number;
  className?: string;
}

/** Poeira fina em deriva lenta, com paralaxe: fundo vivo e discreto, sem imagem. */
export const DustField: React.FC<DustProps> = ({ dark, intensity = 1, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ dark, intensity });
  live.current = { dark, intensity };

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const N = window.innerWidth < 640 ? 70 : 120;
    const dots = Array.from({ length: N }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.25 + Math.random() * 0.75,
      vx: (Math.random() - 0.5) * 0.01,
      vy: -(0.004 + Math.random() * 0.012),
      ph: Math.random() * 6.28,
    }));
    let w = 0;
    let h = 0;
    let t = 0;
    let raf = 0;
    let prev = performance.now();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      t += dt;
      const { dark: d, intensity: k } = live.current;
      ctx.clearRect(0, 0, w, h);
      const rgb = d ? '255,255,255' : '17,17,17';
      for (const p of dots) {
        p.x += p.vx * dt * (0.6 + p.z);
        p.y += p.vy * dt * (0.6 + p.z);
        if (p.y < -0.02) p.y = 1.02;
        if (p.x < -0.02) p.x = 1.02;
        if (p.x > 1.02) p.x = -0.02;
        const px = p.x * w + Math.sin(t * 0.5 + p.ph) * 6 * p.z;
        const py = p.y * h + Math.cos(t * 0.4 + p.ph) * 4 * p.z;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${rgb},${(p.z * 0.42 * k * (0.7 + 0.3 * Math.sin(t + p.ph))).toFixed(3)})`;
        ctx.arc(px, py, p.z * 1.25, 0, 6.2832);
        ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) {
        prev = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
};
