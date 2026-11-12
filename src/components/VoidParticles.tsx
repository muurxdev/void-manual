import React, { useEffect, useRef } from 'react';
import type { VoiceState } from './Particles';

interface Props {
  state: VoiceState;
  /** incrementa a cada palavra falada/ouvida: cada incremento é uma batida */
  pulse: number;
  dark?: boolean;
  className?: string;
}

// mesmo desenho da marca (V com porca sextavada), em coordenadas 0..64
const LOGO = 'M4 6h16l12 29L44 6h16L40 58H24L4 6Zm28 22.5 7 4v8l-7 4-7-4v-8l7-4Zm0 5.2-2.6 1.5v3l2.6 1.5 2.6-1.5v-3L32 33.7Z';

interface Pt {
  x: number;
  y: number;
  z: number;
  k: number; // posição no degradê 0..1
  r: number; // fase individual
}

function sampleLogo(step: number): Pt[] {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return [];
  g.scale(S / 64, S / 64);
  g.fillStyle = '#000';
  g.fill(new Path2D(LOGO), 'evenodd');
  const data = g.getImageData(0, 0, S, S).data;
  const pts: Pt[] = [];
  for (let y = 0; y < S; y += step) {
    for (let x = 0; x < S; x += step) {
      if (data[(y * S + x) * 4 + 3] > 140) {
        const nx = (x - S / 2) / (S / 2);
        const ny = (y - S / 2) / (S / 2);
        pts.push({ x: nx + (Math.random() - 0.5) * 0.012, y: ny + (Math.random() - 0.5) * 0.012, z: (Math.random() - 0.5) * 0.34, k: (nx + 1) / 2, r: Math.random() * 6.28 });
      }
    }
  }
  return pts;
}

/**
 * Nuvem de pontos com o desenho da marca do Void, girando em 3D. Respira parada, sacode ao
 * ouvir, gira ao pensar e bate a cada palavra falada. Fundo transparente, sempre escura/clara
 * por cima de quem a usa (cores próprias).
 */
export const VoidParticles: React.FC<Props> = ({ state, pulse, dark = true, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ state, beat: 0, last: pulse, dark });
  live.current.state = state;
  live.current.dark = dark;

  useEffect(() => {
    if (pulse !== live.current.last) {
      live.current.last = pulse;
      live.current.beat = 1;
    }
  }, [pulse]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const small = window.innerWidth < 640;
    const pts = sampleLogo(3);
    // poeira solta em volta
    const dust: Pt[] = Array.from({ length: small ? 140 : 260 }, () => {
      const a = Math.random() * 6.28;
      const d = 0.9 + Math.random() * 0.9;
      return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.85, z: (Math.random() - 0.5) * 1.4, k: Math.random(), r: Math.random() * 6.28 };
    });

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
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const BUCKETS = 12;
    const mk = (dk: boolean) =>
      Array.from({ length: BUCKETS }, (_, i) => {
        const t = i / (BUCKETS - 1);
        const k = 1 - Math.abs(t - 0.5) * 2;
        return dk ? `hsl(0 0% ${58 + k * 42}%)` : `hsl(0 0% ${42 - k * 34}%)`; // escuro: prata → branco; claro: grafite → preto
      });
    const palettes = { dark: mk(true), light: mk(false) };
    const buckets: number[][] = Array.from({ length: BUCKETS }, () => []);

    let raf = 0;
    let energy = 0;
    let spin = 0;
    const t0 = performance.now();

    let last = 0;
    const draw = (now: number) => {
      // parado: 30 quadros por segundo bastam e poupam a bateria
      if (live.current.state === 'idle' && now - last < 32) {
        raf = requestAnimationFrame(draw);
        return;
      }
      last = now;
      const t = reduce ? 0 : (now - t0) / 1000;
      const s = live.current;
      const target = s.state === 'listening' ? 0.5 : s.state === 'speaking' ? 0.65 : s.state === 'thinking' ? 0.3 : 0.08;
      energy += (target - energy) * 0.06;
      s.beat *= 0.9;
      if (s.state === 'thinking') spin += 0.035;
      else spin += (Math.round(spin / 6.2832) * 6.2832 - spin) * 0.06; // volta de frente

      ctx.clearRect(0, 0, w, h);
      // brilho suave atrás da marca, que cresce com a energia (ouvindo/falando)
      {
        const gr = Math.min(w, h * 0.6) * 0.62;
        const halo = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, gr);
        const a0 = 0.05 + energy * 0.2 + live.current.beat * 0.08;
        halo.addColorStop(0, live.current.dark ? `rgba(255,255,255,${a0})` : `rgba(0,0,0,${a0 * 0.7})`);
        halo.addColorStop(1, "rgba(128,128,128,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(w / 2 - gr, h / 2 - gr, gr * 2, gr * 2);
      }
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h * 0.6) * 0.325 * (1 + Math.sin(t * 1.2) * 0.012 + s.beat * 0.06);
      const yaw = Math.sin(t * 0.45) * 0.5 + spin;
      const pitch = Math.sin(t * 0.33) * 0.12;
      const cyaw = Math.cos(yaw);
      const syaw = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const amp = 0.012 + energy * 0.1 + s.beat * 0.09;
      for (const b of buckets) b.length = 0;

      const place = (p: Pt, extra: number) => {
        // ondulação que anda pelo corpo
        const n = Math.sin(p.x * 3.4 + t * 1.8 + p.r * 0.2) * Math.cos(p.y * 3.1 - t * 1.4);
        const z0 = p.z + n * amp * 1.6;
        const x0 = p.x + Math.sin(p.r + t * 2) * amp * 0.5 * extra;
        const y0 = p.y + Math.cos(p.r + t * 1.7) * amp * 0.5 * extra;
        const x1 = x0 * cyaw + z0 * syaw;
        const z1 = -x0 * syaw + z0 * cyaw;
        const y2 = y0 * cp - z1 * sp;
        const z2 = y0 * sp + z1 * cp;
        const f = 6 / (6 - z2);
        return { sx: cx + x1 * scale * f, sy: cy + y2 * scale * f, f, z: z2 };
      };

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = place(p, 1);
        const sz = 1.15 * q.f * (small ? 1.25 : 1);
        const bi = Math.max(0, Math.min(BUCKETS - 1, Math.floor((p.k * 0.8 + (q.z + 0.4) * 0.35) * BUCKETS)));
        buckets[bi].push(q.sx, q.sy, sz);
      }
      for (let b = 0; b < BUCKETS; b++) {
        const arr = buckets[b];
        if (!arr.length) continue;
        ctx.fillStyle = (s.dark ? palettes.dark : palettes.light)[b];
        ctx.globalAlpha = 0.95;
        for (let i = 0; i < arr.length; i += 3) ctx.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 2]);
      }
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = s.dark ? '#d0d0d0' : '#555555';
      for (const p of dust) {
        const q = place(p, 3);
        const tw = 0.5 + 0.5 * Math.sin(t * 1.5 + p.r * 3);
        ctx.globalAlpha = 0.15 + 0.4 * tw;
        ctx.fillRect(q.sx, q.sy, 1.1 * q.f, 1.1 * q.f);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    // aba escondida ou app em segundo plano: pausa por completo
    const onVis = () => {
      cancelAnimationFrame(raf);
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
