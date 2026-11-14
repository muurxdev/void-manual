import React, { useEffect, useRef } from 'react';
import type { Stage } from './VoidParticles';

interface Props {
  stage: Stage;
  /** incrementa a cada palavra falada ou ouvida: dá um impulso na forma */
  pulse: number;
  className?: string;
}

// amp: deformação · spd: velocidade · spread: quanto as linhas se abrem em leque · size: tamanho · twist: giro entre as linhas
const PARAMS: Record<Stage, { amp: number; spd: number; spread: number; size: number; twist: number }> = {
  idle: { amp: 0.16, spd: 0.35, spread: 0.55, size: 1, twist: 0.1 },
  listen: { amp: 0.3, spd: 0.9, spread: 0.9, size: 1.04, twist: 0.14 },
  read: { amp: 0.12, spd: 0.7, spread: 0.22, size: 0.96, twist: 0.06 },
  search: { amp: 0.24, spd: 1.3, spread: 1.15, size: 0.98, twist: 0.2 },
  diagnose: { amp: 0.1, spd: 0.6, spread: 0.3, size: 0.82, twist: 0.04 },
  speak: { amp: 0.34, spd: 0.8, spread: 0.85, size: 1.05, twist: 0.12 },
};

const LINES = 56;
const TAU = Math.PI * 2;

/**
 * Forma do Void Voice: dezenas de linhas finas de luz ciano, cada uma um círculo deformado e
 * girado um pouco mais que a anterior, que juntas desenham uma fita torcida em 3D. Muda de abertura,
 * velocidade e tamanho em cada estágio; cada palavra dá um impulso.
 */
export const VoidOrb: React.FC<Props> = ({ stage, pulse, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ stage, last: pulse, level: 0 });
  live.current.stage = stage;

  useEffect(() => {
    if (pulse !== live.current.last) {
      live.current.last = pulse;
      live.current.level = 1;
    }
  }, [pulse]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    let w = 0;
    let h = 0;
    const fit = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const cur = { ...PARAMS.idle, size: 0.3 };
    let t = 0;
    let appear = reduce ? 1 : 0;
    let raf = 0;
    let lastT = performance.now();
    const N = 120;

    const draw = (now: number) => {
      const dt = Math.min(0.12, (now - lastT) / 1000);
      lastT = now;
      const s = live.current;
      const tp = PARAMS[s.stage];
      const k = 1 - Math.pow(0.03, dt);
      cur.amp += (tp.amp - cur.amp) * k;
      cur.spd += (tp.spd - cur.spd) * k;
      cur.spread += (tp.spread - cur.spread) * k;
      cur.size += (tp.size - cur.size) * k;
      cur.twist += (tp.twist - cur.twist) * k;
      s.level *= Math.pow(0.1, dt);
      appear = Math.min(1, appear + dt * 0.9);
      const ap = 1 - Math.pow(1 - appear, 3);
      if (!reduce) t += dt * cur.spd;

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.3 * cur.size * (0.45 + 0.55 * ap) * (1 + s.level * 0.07);
      const amp = cur.amp + s.level * 0.14;

      // luz de fundo
      const gr = Math.min(R * 2.4, Math.min(w, h) * 0.5);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
      g.addColorStop(0, 'rgba(34,211,238,' + (0.1 + amp * 0.12) * ap + ')');
      g.addColorStop(1, 'rgba(34,211,238,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);

      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 0.9;
      for (let i = 0; i < LINES; i++) {
        const u = i / (LINES - 1); // 0..1 ao longo da fita
        const ph = u * TAU * cur.spread; // fase própria de cada linha
        const rot = u * TAU * cur.twist * 3 + t * 0.15;
        const sc = 0.78 + 0.3 * Math.sin(u * Math.PI);
        ctx.beginPath();
        for (let j = 0; j <= N; j++) {
          const a = (j / N) * TAU;
          const r =
            R *
            sc *
            (1 +
              amp * Math.sin(2 * a + ph + t * 1.1) * 0.9 +
              amp * 0.7 * Math.sin(3 * a - ph * 1.3 - t * 0.9) +
              amp * 0.35 * Math.sin(5 * a + ph * 0.6 + t * 1.6) * (0.4 + s.level));
          const x = cx + Math.cos(a + rot) * r;
          const y = cy + Math.sin(a + rot) * r;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const fade = 0.2 + 0.5 * Math.sin(u * Math.PI);
        ctx.strokeStyle = 'rgba(' + (40 + u * 40) + ',' + (200 + u * 40) + ',255,' + fade * ap + ')';
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const onVis = () => {
      cancelAnimationFrame(raf);
      lastT = performance.now();
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
};
