import React, { useEffect, useRef } from 'react';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface ParticlesProps {
  state: VoiceState;
  /** incrementa a cada palavra falada/ouvida: cada incremento é uma "batida" */
  pulse: number;
  dark: boolean;
  className?: string;
}

interface Burst {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

const LAT = 22;
const LON = 36;

/**
 * Malha de pontos que respira (esfera deformada por ruído) cercada de poeira, no estilo de
 * visualizadores de música. Reage às PALAVRAS: cada palavra é uma batida que expande a malha
 * e solta fagulhas. Não depende da onda de áudio.
 */
export const Particles: React.FC<ParticlesProps> = ({ state, pulse, dark, className }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ state, dark, beat: 0, spawn: 0, lastPulse: pulse });
  live.current.state = state;
  live.current.dark = dark;

  useEffect(() => {
    if (pulse !== live.current.lastPulse) {
      live.current.lastPulse = pulse;
      live.current.beat = 1;
      live.current.spawn += 1;
    }
  }, [pulse]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lon = window.innerWidth < 640 ? 28 : LON;
    const lat = window.innerWidth < 640 ? 18 : LAT;
    // pontos da esfera (latitude x longitude)
    const base: { x: number; y: number; z: number }[][] = [];
    for (let i = 0; i <= lat; i++) {
      const v = (i / lat) * Math.PI;
      const ring: { x: number; y: number; z: number }[] = [];
      for (let j = 0; j < lon; j++) {
        const u = (j / lon) * Math.PI * 2;
        ring.push({ x: Math.sin(v) * Math.cos(u), y: Math.cos(v), z: Math.sin(v) * Math.sin(u) });
      }
      base.push(ring);
    }
    const dust = Array.from({ length: 70 }, () => ({
      a: Math.random() * 6.2832,
      r: 0.85 + Math.random() * 0.9,
      s: 0.5 + Math.random() * 1.3,
      sp: (0.05 + Math.random() * 0.25) * (Math.random() < 0.5 ? -1 : 1),
      al: 0.15 + Math.random() * 0.45,
    }));
    const bursts: Burst[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;
    let t = 0;
    let spin = 0;
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
      const L = live.current;
      L.beat *= Math.exp(-dt * 4.5);

      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.3;
      const thinking = L.state === 'thinking';
      spin += dt * (thinking ? 1.1 : L.state === 'idle' ? 0.14 : 0.3);
      // deformação: calma parada, viva quando ouve ou fala, concentrada quando pensa
      const amp = (L.state === 'idle' ? 0.1 : thinking ? 0.2 : 0.17) + L.beat * 0.34;
      const speed = thinking ? 2.1 : 0.9;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = L.dark ? 'lighter' : 'source-over';
      const rgb = L.dark ? '255,255,255' : '17,17,17';
      const cosY = Math.cos(spin);
      const sinY = Math.sin(spin);
      const tilt = 0.35;
      const cosX = Math.cos(tilt);
      const sinX = Math.sin(tilt);

      // projeta a malha
      const pts = base.map((ring) =>
        ring.map((p) => {
          const n =
            Math.sin(p.x * 2.6 + t * speed) * Math.cos(p.y * 2.9 - t * speed * 0.8) * 0.6 +
            Math.sin(p.z * 3.4 + t * speed * 1.2) * 0.4 +
            Math.sin((p.x + p.y) * 5 + t * speed * 1.6) * 0.18;
          const rr = R * (1 + amp * n);
          let x = p.x * rr;
          let y = p.y * rr;
          let z = p.z * rr;
          const x1 = x * cosY - z * sinY;
          const z1 = x * sinY + z * cosY;
          const y1 = y * cosX - z1 * sinX;
          const z2 = y * sinX + z1 * cosX;
          x = x1;
          y = y1;
          z = z2;
          const persp = 1 / (1 - z / (R * 4));
          return { x: cx + x * persp, y: cy + y * persp, z: z / R };
        })
      );

      // anéis (aramado)
      ctx.lineWidth = 0.6;
      for (let i = 0; i < pts.length; i += 2) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${rgb},${(0.16 + L.beat * 0.2).toFixed(3)})`;
        const ring = pts[i];
        ctx.moveTo(ring[0].x, ring[0].y);
        for (let j = 1; j <= ring.length; j++) ctx.lineTo(ring[j % ring.length].x, ring[j % ring.length].y);
        ctx.stroke();
      }
      // pontos, mais fortes na frente
      for (const ring of pts) {
        for (const p of ring) {
          const depth = (p.z + 1) / 2;
          ctx.beginPath();
          ctx.fillStyle = `rgba(${rgb},${(0.15 + depth * 0.75).toFixed(3)})`;
          ctx.arc(p.x, p.y, 0.6 + depth * 1.3 * (1 + L.beat * 0.5), 0, 6.2832);
          ctx.fill();
        }
      }

      // poeira orbitando
      for (const d of dust) {
        const ang = d.a + t * d.sp;
        const rad = R * d.r * (1 + L.beat * 0.25);
        ctx.beginPath();
        ctx.fillStyle = `rgba(${rgb},${(d.al * (0.6 + 0.4 * Math.sin(t + d.a))).toFixed(3)})`;
        ctx.arc(cx + Math.cos(ang) * rad * 1.15, cy + Math.sin(ang) * rad * 0.95, d.s, 0, 6.2832);
        ctx.fill();
      }

      // fagulhas a cada palavra
      while (L.spawn > 0) {
        L.spawn -= 1;
        for (let k = 0; k < 14; k++) {
          const a = Math.random() * 6.2832;
          const sp = 50 + Math.random() * 130;
          bursts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, size: 0.9 + Math.random() * 1.5 });
        }
        if (bursts.length > 150) bursts.splice(0, bursts.length - 150);
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vx *= 0.97;
        b.vy *= 0.97;
        b.life -= dt * 1.4;
        if (b.life <= 0) {
          bursts.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.fillStyle = `rgba(${rgb},${(b.life * 0.8).toFixed(3)})`;
        ctx.arc(b.x, b.y, b.size, 0, 6.2832);
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
