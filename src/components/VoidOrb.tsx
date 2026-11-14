import React, { useEffect, useRef } from 'react';
import type { Stage } from './VoidParticles';

interface Props {
  stage: Stage;
  /** incrementa a cada palavra falada ou ouvida: solta uma onda */
  pulse: number;
  className?: string;
}

type RGB = [number, number, number];

/** Cores do anel em cada estágio (5 paradas do degradê). */
const PALETTE: Record<Stage, RGB[]> = {
  idle: [[60, 190, 255], [130, 90, 255], [255, 110, 190], [60, 150, 255], [60, 190, 255]],
  listen: [[70, 230, 255], [60, 140, 255], [200, 250, 255], [90, 200, 255], [70, 230, 255]],
  read: [[200, 210, 255], [120, 110, 255], [255, 255, 255], [90, 150, 255], [200, 210, 255]],
  search: [[170, 110, 255], [255, 100, 190], [120, 150, 255], [255, 140, 220], [170, 110, 255]],
  diagnose: [[255, 190, 90], [255, 255, 255], [255, 120, 80], [255, 220, 150], [255, 190, 90]],
  speak: [[255, 255, 255], [60, 200, 255], [255, 100, 190], [130, 110, 255], [255, 255, 255]],
};

// amp: ondulação do anel · spd: velocidade · rad: tamanho · glow: brilho · sweep: arco que gira · sat: satélites · scan: varredura · beat: batimento · rip: ondas contínuas
const PARAMS: Record<Stage, { amp: number; spd: number; rad: number; glow: number; sweep: number; sat: number; scan: number; beat: number; rip: number }> = {
  idle: { amp: 0.04, spd: 0.35, rad: 1, glow: 0.45, sweep: 0, sat: 0, scan: 0, beat: 0, rip: 0 },
  listen: { amp: 0.07, spd: 1.1, rad: 1.05, glow: 0.8, sweep: 0, sat: 0, scan: 0, beat: 0, rip: 0 },
  read: { amp: 0.018, spd: 0.7, rad: 0.96, glow: 0.6, sweep: 0.5, sat: 0, scan: 1, beat: 0, rip: 0 },
  search: { amp: 0.045, spd: 1.2, rad: 0.92, glow: 0.7, sweep: 0.3, sat: 1, scan: 0, beat: 0, rip: 0 },
  diagnose: { amp: 0.015, spd: 0.9, rad: 0.84, glow: 0.95, sweep: 1, sat: 0, scan: 0, beat: 1, rip: 0 },
  speak: { amp: 0.06, spd: 1.0, rad: 1.03, glow: 0.85, sweep: 0, sat: 0, scan: 0, beat: 0, rip: 1 },
};

const TAU = Math.PI * 2;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Orbe do Void Voice: um anel de luz líquido sobre o vazio. Cada estágio tem um comportamento
 * próprio: ouvindo (ondula com a sua voz), lendo (varredura), procurando (satélites em órbita),
 * diagnosticando (encolhe e bate como um coração) e falando (ondas saindo do anel).
 */
export const VoidOrb: React.FC<Props> = ({ stage, pulse, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ stage, pulses: [] as number[], last: pulse, level: 0 });
  live.current.stage = stage;

  useEffect(() => {
    if (pulse !== live.current.last) {
      live.current.last = pulse;
      live.current.pulses.push(performance.now());
      live.current.level = 1;
      if (live.current.pulses.length > 8) live.current.pulses.shift();
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

    const cur = { ...PARAMS.idle };
    const col: RGB[] = PALETTE.idle.map((c) => [...c] as RGB);
    let phase = 0;
    let rot = 0;
    let sweepA = 0;
    let appear = reduce ? 1 : 0;
    let raf = 0;
    let lastT = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      const s = live.current;
      const tp = PARAMS[s.stage];
      const tc = PALETTE[s.stage];
      const k = 1 - Math.pow(0.002, dt);
      (Object.keys(tp) as (keyof typeof tp)[]).forEach((key) => {
        cur[key] = mix(cur[key], tp[key], k * 0.8);
      });
      for (let i = 0; i < 5; i++) for (let c = 0; c < 3; c++) col[i][c] = mix(col[i][c], tc[i][c], k * 0.7);
      s.level *= Math.pow(0.12, dt); // o impulso da palavra decai
      appear = Math.min(1, appear + dt * 1.1);
      const ap = 1 - Math.pow(1 - appear, 3);
      const t = reduce ? 0 : now / 1000;
      phase += dt * cur.spd * (reduce ? 0 : 1);
      rot += dt * (0.25 + cur.spd * 0.35) * (reduce ? 0 : 1);
      sweepA += dt * (1.6 + cur.sweep * 2.2) * (reduce ? 0 : 1);

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const base = Math.min(w, h) * 0.3;
      const heart = cur.beat * Math.max(0, Math.sin(t * 5.2)) ** 6 * 0.07;
      const R = base * cur.rad * (0.5 + 0.5 * ap) * (1 + Math.sin(t * 1.3) * 0.012 + heart + s.level * 0.05);
      const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

      // luz de fundo
      const gr = Math.min(R * 2.6, Math.min(w, h) * 0.5);
      const bg = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, gr);
      bg.addColorStop(0, rgba(col[1], 0.12 * cur.glow * ap));
      bg.addColorStop(0.55, rgba(col[3], 0.05 * cur.glow * ap));
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);

      // ondas: uma por palavra, e contínuas ao falar
      ctx.lineWidth = 1.5;
      s.pulses = s.pulses.filter((ts) => now - ts < 1500);
      for (const ts of s.pulses) {
        const u = (now - ts) / 1500;
        ctx.strokeStyle = rgba(col[0], (1 - u) * 0.55);
        ctx.beginPath();
        ctx.arc(cx, cy, R * (1.08 + u * 0.75), 0, TAU);
        ctx.stroke();
      }
      if (cur.rip > 0.05) {
        for (let i = 0; i < 3; i++) {
          const u = (t * 0.5 + i / 3) % 1;
          ctx.strokeStyle = rgba(col[2], (1 - u) * 0.28 * cur.rip);
          ctx.beginPath();
          ctx.arc(cx, cy, R * (1.06 + u * 0.7), 0, TAU);
          ctx.stroke();
        }
      }

      // anel líquido: camadas com ondulações diferentes, somadas com brilho
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      const amp = (cur.amp + s.level * 0.05) * R;
      for (let layer = 0; layer < 4; layer++) {
        const g = ctx.createConicGradient(rot * (layer % 2 ? -1 : 1) + layer, cx, cy);
        for (let i = 0; i < 5; i++) g.addColorStop(i / 4, rgba(col[(i + layer) % 5], 0.62 - layer * 0.1));
        ctx.strokeStyle = g;
        ctx.lineWidth = R * (0.046 - layer * 0.008);
        ctx.shadowColor = rgba(col[layer % 5], 0.3);
        ctx.shadowBlur = (4 + cur.glow * 18) * (layer === 0 ? 1.3 : 0.7) * ap;
        ctx.globalAlpha = ap * (layer === 0 ? 1 : 0.75);
        ctx.beginPath();
        const n = 140;
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * TAU;
          const d =
            Math.sin(a * 2 + phase * (1.1 + layer * 0.3) + layer * 1.7) * 0.6 +
            Math.sin(a * 3 - phase * (0.8 + layer * 0.25) + layer * 2.3) * 0.5 +
            Math.sin(a * 5 + phase * 1.6 + layer) * 0.25 * (0.4 + s.level);
          const r = R * (1 + layer * 0.012) + d * amp;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // arco que gira (lendo e diagnosticando)
      if (cur.sweep > 0.05) {
        ctx.lineWidth = R * 0.05;
        ctx.lineCap = 'round';
        const rr = R * 1.12;
        const g = ctx.createConicGradient(sweepA, cx, cy);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.18, rgba(col[2], 0.95 * cur.sweep));
        g.addColorStop(0.2, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, TAU);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';

      // o vazio dentro do anel
      const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.98);
      inner.addColorStop(0, 'rgba(0,0,0,1)');
      inner.addColorStop(0.85, 'rgba(0,0,0,.96)');
      inner.addColorStop(1, 'rgba(0,0,0,.7)');
      ctx.fillStyle = inner;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.97, 0, TAU);
      ctx.fill();

      // lendo: linha de varredura dentro do vazio
      if (cur.scan > 0.05) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.92, 0, TAU);
        ctx.clip();
        const y = cy + Math.sin(t * 2.2) * R * 0.78;
        const lg = ctx.createLinearGradient(0, y - R * 0.3, 0, y + R * 0.02);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(1, rgba(col[0], 0.35 * cur.scan));
        ctx.fillStyle = lg;
        ctx.fillRect(cx - R, y - R * 0.3, R * 2, R * 0.32);
        ctx.fillStyle = rgba([255, 255, 255], 0.9 * cur.scan);
        ctx.fillRect(cx - R, y, R * 2, 1.5);
        ctx.restore();
      }

      // procurando: satélites em órbita
      if (cur.sat > 0.05) {
        for (let i = 0; i < 5; i++) {
          const a = t * (0.9 + i * 0.27) * (i % 2 ? -1 : 1) + i * 1.9;
          const rr = R * (1.28 + i * 0.1 + Math.sin(t * 1.1 + i) * 0.03);
          const sx = cx + Math.cos(a) * rr;
          const sy = cy + Math.sin(a) * rr * 0.9;
          const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.1);
          sg.addColorStop(0, rgba(col[(i + 1) % 5], 0.95 * cur.sat));
          sg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sg;
          ctx.fillRect(sx - R * 0.1, sy - R * 0.1, R * 0.2, R * 0.2);
          ctx.fillStyle = `rgba(255,255,255,${0.95 * cur.sat})`;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1.4, R * 0.018), 0, TAU);
          ctx.fill();
        }
      }

      // diagnosticando: marcas de medição em volta
      if (cur.beat > 0.05) {
        ctx.strokeStyle = rgba(col[1], 0.7 * cur.beat);
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * TAU + rot * 0.6;
          const long = i % 4 === 0;
          const r0 = R * 1.22;
          const r1 = R * (long ? 1.32 : 1.27);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
          ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.stroke();
        }
      }
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
