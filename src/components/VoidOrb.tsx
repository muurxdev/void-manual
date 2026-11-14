import React, { useEffect, useRef } from 'react';
import type { Stage } from './VoidParticles';

interface Props {
  stage: Stage;
  /** incrementa a cada palavra falada ou ouvida: dá um impulso na onda */
  pulse: number;
  className?: string;
}

// amp: altura da onda · spd: velocidade · k: frequência · mix: quanto as curvas se separam
const PARAMS: Record<Stage, { amp: number; spd: number; k: number; mix: number }> = {
  idle: { amp: 0.07, spd: 1.2, k: 1.4, mix: 0.5 },
  listen: { amp: 0.3, spd: 2.6, k: 2.2, mix: 1 },
  read: { amp: 0.14, spd: 1.6, k: 3.2, mix: 0.7 },
  search: { amp: 0.2, spd: 3.4, k: 2.8, mix: 1 },
  diagnose: { amp: 0.16, spd: 1.1, k: 4.4, mix: 0.6 },
  speak: { amp: 0.34, spd: 2.2, k: 2, mix: 1 },
};

// cores da Siri (iOS 9 em diante): azul, rosa e verde, somadas com brilho
const COLORS = ['15, 130, 255', '255, 55, 120', '48, 220, 155'];

const att = (x: number) => Math.pow(4 / (4 + Math.pow(x, 4)), 4); // atenuação: a onda some nas pontas

interface Curve {
  c: number;
  life: number;
  dur: number;
  amp: number;
  k: number;
  off: number;
  sp: number;
}

const spawn = (c: number): Curve => ({
  c,
  life: Math.random() * 3,
  dur: 2.2 + Math.random() * 2.4,
  amp: 0.35 + Math.random() * 0.65,
  k: 0.6 + Math.random() * 1.1,
  off: (Math.random() - 0.5) * 1.6,
  sp: 0.6 + Math.random() * 0.9,
});

/**
 * Onda do Void Voice no estilo da Siri: curvas azul, rosa e verde somadas com brilho, uma linha
 * branca no centro e atenuação nas pontas. A altura segue o estágio (ouvindo, lendo, procurando,
 * diagnosticando, falando) e cada palavra dá um impulso.
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

    const curves: Curve[] = COLORS.flatMap((_, c) => [spawn(c), spawn(c), spawn(c)]);
    const cur = { ...PARAMS.idle };
    let phase = 0;
    let amp = 0.02;
    let appear = reduce ? 1 : 0;
    let raf = 0;
    let lastT = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const s = live.current;
      const tp = PARAMS[s.stage];
      const k = 1 - Math.pow(0.01, dt);
      cur.spd += (tp.spd - cur.spd) * k;
      cur.k += (tp.k - cur.k) * k;
      cur.mix += (tp.mix - cur.mix) * k;
      s.level *= Math.pow(0.08, dt);
      const target = tp.amp + s.level * 0.22 + (s.stage === 'listen' || s.stage === 'speak' ? Math.sin(now / 130) * 0.03 : 0);
      amp += (target - amp) * (1 - Math.pow(0.002, dt));
      appear = Math.min(1, appear + dt * 1.2);
      phase += dt * cur.spd * (reduce ? 0 : 1);

      ctx.clearRect(0, 0, w, h);
      const cy = h / 2;
      const H = Math.min(h, w) * 0.5;
      const ap = 1 - Math.pow(1 - appear, 3);
      const STEPS = 160;

      // brilho suave sob a onda
      const glow = ctx.createRadialGradient(w / 2, cy, 0, w / 2, cy, w * 0.55);
      glow.addColorStop(0, 'rgba(80,140,255,' + (0.1 * ap + amp * 0.18) + ')');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.globalCompositeOperation = 'lighter';
      for (const cv of curves) {
        cv.life += dt * (reduce ? 0 : 1);
        if (cv.life > cv.dur) Object.assign(cv, spawn(cv.c), { life: 0 });
        const env = Math.sin((cv.life / cv.dur) * Math.PI);
        const A = H * amp * cv.amp * env * ap * (0.55 + 0.45 * cur.mix);
        ctx.beginPath();
        for (let i = 0; i <= STEPS; i++) {
          const x = (i / STEPS) * 4 - 2;
          const y = cy + att(x) * A * Math.sin(cur.k * cv.k * x * 1.6 - phase * cv.sp + cv.off * cur.mix * 3);
          const px = (i / STEPS) * w;
          if (i === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.strokeStyle = 'rgba(' + COLORS[cv.c] + ',' + (0.5 * env + 0.12) + ')';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = 'rgba(' + COLORS[cv.c] + ',.8)';
        ctx.shadowBlur = 14;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';

      // linha branca do centro: reta quando calmo, ondula com a energia
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i++) {
        const x = (i / STEPS) * 4 - 2;
        const y = cy + att(x) * H * amp * 0.28 * ap * Math.sin(cur.k * x * 2.2 - phase * 1.4);
        const px = (i / STEPS) * w;
        if (i === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      const lg = ctx.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.2, 'rgba(255,255,255,.75)');
      lg.addColorStop(0.5, 'rgba(255,255,255,1)');
      lg.addColorStop(0.8, 'rgba(255,255,255,.75)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = lg;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = ap;
      ctx.stroke();
      ctx.globalAlpha = 1;
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
