import React, { useEffect, useRef } from 'react';
import type { VoiceState } from '../data/types';

/** Estágios: o buraco negro muda de comportamento conforme o Void ouve, lê, procura, diagnostica e responde. */
export type Stage = 'idle' | 'listen' | 'read' | 'search' | 'diagnose' | 'speak';

// open: inclinação do disco · spread: raio extra · spin: velocidade · glow: brilho do anel · pull: puxa para dentro
const FORMS: Record<Stage, { open: number; spread: number; spin: number; glow: number; pull: number }> = {
  idle: { open: 0.1, spread: 0, spin: 0.35, glow: 0.35, pull: 0 },
  listen: { open: 0.16, spread: 0.12, spin: 0.8, glow: 0.7, pull: 0 },
  read: { open: 0.42, spread: 0.02, spin: 0.9, glow: 0.5, pull: 0 },
  search: { open: 0.26, spread: 0.34, spin: 1.3, glow: 0.6, pull: 0 },
  diagnose: { open: 0.12, spread: -0.18, spin: 2.2, glow: 1, pull: 0.5 },
  speak: { open: 0.14, spread: 0.1, spin: 0.9, glow: 0.8, pull: 0 },
};

/** Traduz o estado da voz e a fase do "pensando" no estágio da animação. */
export function stageOf(state: VoiceState, phase = ''): Stage {
  if (state === 'listening') return 'listen';
  if (state === 'speaking') return 'speak';
  if (state === 'thinking') return /Consultando/.test(phase) ? 'search' : /Diagnostic/.test(phase) ? 'diagnose' : 'read';
  return 'idle';
}

interface Props {
  state: VoiceState;
  stage?: Stage;
  /** o disco se monta a partir da poeira ao aparecer */
  intro?: boolean;
  /** incrementa a cada palavra: cada incremento solta uma onda */
  pulse: number;
  dark?: boolean;
  className?: string;
  centerY?: number;
  sizeMul?: number;
}

interface P {
  r: number;
  a: number;
  y: number;
  s: number;
  t: number;
}

const BUCKETS = 10;
const TAU = 6.2832;

/**
 * Buraco negro em partículas: vazio no centro, anel de fótons e disco de acreção que gira mais
 * rápido por dentro. A luz do lado de trás do disco se curva por cima do vazio (o arco) e uma
 * imagem fraca aparece por baixo. Cada palavra solta uma onda que se expande.
 */
export const VoidParticles: React.FC<Props> = ({ state, stage, intro = true, pulse, dark = true, className, centerY = 0.5, sizeMul = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ stage: stage ?? stageOf(state), state, dark, cyf: centerY, mul: sizeMul, pulses: [] as number[], last: pulse });
  live.current.stage = stage ?? stageOf(state);
  live.current.state = state;
  live.current.dark = dark;
  live.current.cyf = centerY;
  live.current.mul = sizeMul;

  useEffect(() => {
    if (pulse !== live.current.last) {
      live.current.last = pulse;
      live.current.pulses.push(performance.now());
      if (live.current.pulses.length > 6) live.current.pulses.shift();
    }
  }, [pulse]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const small = window.innerWidth < 640;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const N = small ? 900 : 1500;
    const pts: P[] = Array.from({ length: N }, () => ({
      r: 1.18 + Math.pow(Math.random(), 1.6) * 1.55,
      a: Math.random() * TAU,
      y: (Math.random() - 0.5) * 0.08,
      s: 0.7 + Math.random() * 0.9,
      t: Math.random() * TAU,
    }));
    const dust = Array.from({ length: small ? 70 : 130 }, () => ({ a: Math.random() * TAU, d: 3.2 + Math.random() * 2.6, t: Math.random() * TAU }));

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

    const pal = (dk: boolean) =>
      Array.from({ length: BUCKETS }, (_, i) => {
        const k = i / (BUCKETS - 1);
        return dk ? `hsl(0 0% ${52 + k * 48}%)` : `hsl(0 0% ${46 - k * 42}%)`;
      });
    const palettes = { dark: pal(true), light: pal(false) };
    const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);

    const f = { open: 0.1, spread: 0, spin: 0.35, glow: 0.35, pull: 0 };
    let ang = 0;
    let assemble = intro && !reduce ? 0 : 1;
    let raf = 0;
    let lastT = performance.now();
    let skip = 0;

    const draw = (now: number) => {
      const s = live.current;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      // parado: 30 quadros por segundo bastam
      if (s.state === 'idle' && (skip ^= 1)) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const tf = FORMS[s.stage];
      const k = 1 - Math.pow(0.001, dt);
      f.open += (tf.open - f.open) * k * 0.9;
      f.spread += (tf.spread - f.spread) * k * 0.9;
      f.spin += (tf.spin - f.spin) * k * 0.9;
      f.glow += (tf.glow - f.glow) * k;
      f.pull += (tf.pull - f.pull) * k;
      assemble = Math.min(1, assemble + dt * 0.9);
      const ease = 1 - Math.pow(1 - assemble, 3);
      ang += dt * f.spin * (reduce ? 0 : 1);
      const t = now / 1000;

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h * s.cyf;
      const R = Math.min(w, h * 0.62) * 0.15 * s.mul * (1 + Math.sin(t * 1.1) * 0.015);
      const dk = s.dark;

      // brilho de fundo
      const gr = R * 4.4;
      const halo = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, gr);
      const a0 = 0.03 + f.glow * 0.11;
      halo.addColorStop(0, dk ? 'rgba(255,255,255,' + a0 + ')' : 'rgba(0,0,0,' + a0 * 0.7 + ')');
      halo.addColorStop(1, 'rgba(128,128,128,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);

      // partículas do disco
      for (const b of buckets) b.length = 0;
      const scatter = (1 - ease) * 4;
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        const rr = (p.r + f.spread * (0.4 + 0.6 * Math.sin(p.t + t * 0.7) ** 2)) * (1 - f.pull * 0.25) + scatter * (0.5 + 0.5 * Math.sin(p.t * 3.1));
        const th = p.a + ang * Math.pow(1 / rr, 1.5) * 2.4;
        let x = Math.cos(th) * rr;
        const z = Math.sin(th) * rr;
        const tilt = f.open * 0.9 + 0.08;
        let sy = z * tilt + p.y * rr;
        let bright = 0.5 + 0.5 * Math.cos(th - 0.6);
        if (z < 0) {
          // lado de trás: a luz se curva por cima do vazio
          const rl = 1.12 + (rr - 1.18) * 0.32;
          x *= rl / rr;
          sy = -Math.sqrt(Math.max(0, rl * rl - x * x)) * (0.96 - f.open * 0.25);
          bright = 0.55 + bright * 0.45;
        }
        const sz = (0.9 + p.s * 0.9) * (small ? 1.15 : 1) * (R / 40 + 0.55);
        const bi = Math.max(0, Math.min(BUCKETS - 1, Math.floor((bright * 0.7 + (1.9 - Math.min(rr, 2.7)) * 0.3) * BUCKETS)));
        buckets[bi].push(cx + x * R, cy + sy * R, sz);
        if (z >= 0 && i % 3 === 0) {
          // imagem fraca por baixo do vazio
          const rl2 = 1.1 + (rr - 1.18) * 0.2;
          const x2 = x * (rl2 / rr);
          buckets[Math.max(0, bi - 3)].push(cx + x2 * R, cy + Math.sqrt(Math.max(0, rl2 * rl2 - x2 * x2)) * 0.8 * R, sz * 0.7);
        }
      }
      for (let b = 0; b < BUCKETS; b++) {
        const arr = buckets[b];
        if (!arr.length) continue;
        ctx.fillStyle = (dk ? palettes.dark : palettes.light)[b];
        ctx.globalAlpha = 0.92;
        for (let i = 0; i < arr.length; i += 3) ctx.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 2]);
      }

      // ondas: uma por palavra, expandindo e sumindo; ao falar, saem também em ritmo contínuo
      ctx.lineWidth = 1.2;
      s.pulses = s.pulses.filter((ts) => now - ts < 1600);
      for (const ts of s.pulses) {
        const u = (now - ts) / 1600;
        ctx.globalAlpha = (1 - u) * 0.5;
        ctx.strokeStyle = dk ? '#fff' : '#000';
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.3 + u * 3.2), 0, TAU);
        ctx.stroke();
      }
      if (s.stage === 'speak' && !reduce) {
        const u = (t * 0.7) % 1;
        ctx.globalAlpha = (1 - u) * 0.22;
        ctx.strokeStyle = dk ? '#fff' : '#000';
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.3 + u * 2.6), 0, TAU);
        ctx.stroke();
      }

      // o vazio e o anel de fótons
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, TAU);
      ctx.fill();
      ctx.lineWidth = Math.max(1.4, R * 0.045);
      ctx.strokeStyle = dk ? 'rgba(255,255,255,' + (0.35 + f.glow * 0.6) + ')' : 'rgba(0,0,0,' + (0.5 + f.glow * 0.45) + ')';
      ctx.shadowColor = dk ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,0)';
      ctx.shadowBlur = dk ? 4 + f.glow * 18 : 0;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.02, 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // poeira distante
      ctx.fillStyle = dk ? '#cfcfcf' : '#555';
      for (const d of dust) {
        const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + d.t * 3);
        ctx.globalAlpha = (0.1 + 0.3 * tw) * ease;
        const dd = d.d + Math.sin(t * 0.2 + d.t) * 0.12;
        ctx.fillRect(cx + Math.cos(d.a + t * 0.03) * dd * R, cy + Math.sin(d.a + t * 0.03) * dd * R * 0.8, 1.2, 1.2);
      }
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
