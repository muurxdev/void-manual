import React, { useEffect, useRef } from 'react';

/** Onda de transcrição: respira sozinha e cresce quando chega texto novo. */
export const DictationWave: React.FC<{ level: number; className?: string }> = ({ level, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const lv = useRef(level);
  lv.current = level;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const fit = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    let raf = 0;
    let smooth = 0;
    const t0 = performance.now();
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      smooth += (lv.current - smooth) * 0.2;
      const color = getComputedStyle(canvas).color;
      ctx.clearRect(0, 0, w, h);
      const gap = 5;
      const bars = Math.max(8, Math.floor(w / gap));
      ctx.fillStyle = color;
      for (let i = 0; i < bars; i++) {
        const x = (i + 0.5) * (w / bars);
        const edge = Math.sin((i / (bars - 1)) * Math.PI); // bordas mais baixas
        const n = 0.5 + 0.5 * Math.sin(t * 3.1 + i * 0.55) * Math.sin(t * 1.7 + i * 0.21);
        const a = (0.14 + smooth * 0.86) * (0.35 + 0.65 * n) * (0.25 + 0.75 * edge);
        const bh = Math.max(2, a * h);
        ctx.globalAlpha = 0.35 + 0.65 * a;
        ctx.beginPath();
        ctx.roundRect(x - 1, h / 2 - bh / 2, 2, bh, 1);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
};
