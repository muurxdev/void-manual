import React, { useEffect, useRef } from 'react';
import type { VoiceState } from './Particles';

/** Estágios da animação: a marca muda de forma conforme o Void ouve, lê, procura, diagnostica e responde. */
export type Stage = 'idle' | 'listen' | 'read' | 'search' | 'diagnose' | 'speak';

// forma-alvo de cada estágio: encolher/crescer, abrir os pontos, velocidade de giro, varredura, brilho
const FORMS: Record<Stage, { contract: number; disperse: number; spin: number; scan: number; glow: number }> = {
  idle: { contract: 1, disperse: 0, spin: 0, scan: 0, glow: 0.06 },
  listen: { contract: 1.05, disperse: 0.24, spin: 0, scan: 0, glow: 0.22 },
  read: { contract: 0.95, disperse: 0.08, spin: 0.012, scan: 1, glow: 0.14 },
  search: { contract: 0.86, disperse: 0.5, spin: 0.03, scan: 0, glow: 0.2 },
  diagnose: { contract: 0.58, disperse: 0.02, spin: 0.06, scan: 0, glow: 0.42 },
  speak: { contract: 1.04, disperse: 0.24, spin: 0, scan: 0, glow: 0.26 },
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
  /** se informado, manda no formato (senão deriva de state) */
  stage?: Stage;
  /** a marca se monta a partir da poeira ao aparecer (passar de tela) */
  intro?: boolean;
  /** incrementa a cada palavra falada/ouvida: cada incremento é uma batida */
  pulse: number;
  dark?: boolean;
  className?: string;
  /** altura do centro da marca, de 0 (topo) a 1 (base) */
  centerY?: number;
  /** multiplicador de tamanho (a home usa maior) */
  sizeMul?: number;
}

import { markBody } from './VoidMark';

// mesmo desenho da marca (buraco negro), renderizado e amostrado em pontos
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">${markBody('s', '#000')}</svg>`;

interface Pt {
  x: number;
  y: number;
  z: number;
  k: number; // posição no degradê 0..1
  r: number; // fase individual
}

async function sampleLogo(step: number): Promise<Pt[]> {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return [];
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO_SVG);
  await img.decode();
  g.drawImage(img, 0, 0, S, S);
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
export const VoidParticles: React.FC<Props> = ({ state, stage, intro = true, pulse, dark = true, className, centerY = 0.5, sizeMul = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ state, stage: stage ?? stageOf(state), beat: 0, lastAt: 0, rate: 2.6, last: pulse, dark, cyf: centerY, intro, mul: sizeMul });
  live.current.mul = sizeMul;
  live.current.stage = stage ?? stageOf(state);
  live.current.cyf = centerY;
  live.current.state = state;
  live.current.dark = dark;

  useEffect(() => {
    if (pulse !== live.current.last) {
      live.current.last = pulse;
      live.current.beat = 1;
      const nowMs = performance.now();
      if (live.current.lastAt) {
        const gap = (nowMs - live.current.lastAt) / 1000;
        if (gap > 0.08 && gap < 1.5) live.current.rate += (1 / gap - live.current.rate) * 0.3; // palavras por segundo
      }
      live.current.lastAt = nowMs;
    }
  }, [pulse]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const small = window.innerWidth < 640;
    let pts: Pt[] = [];
    void sampleLogo(2).then((p) => {
      pts = p;
    });
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
    const form = { contract: 1, disperse: 0, spin: 0, scan: 0, glow: 0.06 };
    let beatS = 0; // batida suavizada
    let wavePhase = 0; // fase da onda que atravessa a marca
    let assemble = live.current.intro && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
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
      const tf = FORMS[s.stage];
      const k = 0.07; // a forma muda aos poucos, em vez de pular
      form.contract += (tf.contract - form.contract) * k;
      form.disperse += (tf.disperse - form.disperse) * k;
      form.spin += (tf.spin - form.spin) * k;
      form.scan += (tf.scan - form.scan) * k;
      form.glow += (tf.glow - form.glow) * k;
      assemble = Math.min(1, assemble + 0.014);
      const ease = 1 - Math.pow(1 - assemble, 3);
      const energy0 = form.glow * 2.2;
      energy += (energy0 - energy) * 0.06;
      s.beat *= 0.965;
      // intensidade da fala: sobe e desce devagar, proporcional ao ritmo das palavras (sem batida por palavra)
      const talking = s.stage === 'speak' && performance.now() - s.lastAt < 1100;
      const target2 = s.stage === 'speak' ? (talking ? Math.min(1, 0.3 + s.rate / 5) : 0.22) : s.stage === 'listen' ? 0.3 : 0;
      beatS += (target2 - beatS) * 0.035;
      const speed = s.stage === 'speak' ? 0.5 + s.rate * 0.55 * (0.4 + beatS) : 1.2;
      wavePhase += speed * 0.016;
      if (form.spin > 0.004) spin += form.spin;
      else spin += (Math.round(spin / 6.2832) * 6.2832 - spin) * 0.06; // volta de frente

      ctx.clearRect(0, 0, w, h);
      // brilho suave atrás da marca, que cresce com a energia (ouvindo/falando)
      {
        const gr = Math.min(w, h * 0.6) * 0.62;
        const halo = ctx.createRadialGradient(w / 2, h * live.current.cyf, 0, w / 2, h * live.current.cyf, gr);
        const a0 = 0.05 + form.glow * 0.5 + beatS * 0.1;
        halo.addColorStop(0, live.current.dark ? `rgba(255,255,255,${a0})` : `rgba(0,0,0,${a0 * 0.7})`);
        halo.addColorStop(1, "rgba(128,128,128,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(w / 2 - gr, h * live.current.cyf - gr, gr * 2, gr * 2);
      }
      const cx = w / 2;
      const cy = h * live.current.cyf;
      const scale = Math.min(w, h * 0.6) * 0.46 * live.current.mul * form.contract * (1 + Math.sin(t * 1.2) * 0.012);
      const yaw = Math.sin(t * 0.45) * 0.5 + spin;
      const pitch = Math.sin(t * 0.33) * 0.12;
      const cyaw = Math.cos(yaw);
      const syaw = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const amp = 0.012 + beatS * 0.045;
      for (const b of buckets) b.length = 0;

      const scatter = (1 - ease) * 3.2; // montagem: começa espalhado e se junta
      const place = (p: Pt, extra: number) => {
        // fluxo: os pontos vêm para a frente e voltam, em ondas lentas que saem do centro
        const rad = Math.hypot(p.x, p.y);
        const z0 = p.z + Math.sin(rad * 3.4 - wavePhase * 1.8) * (0.14 + 0.5 * beatS) * (extra > 1 ? 0.6 : 1);
        // abrir: cada ponto se afasta do centro numa medida própria; busca: orbita em volta
        const open = 1 + form.disperse * (0.35 + 0.65 * Math.sin((extra > 1 ? p.r * 3.1 : p.x * 2.1 + p.y * 1.7) + wavePhase * 0.7) ** 2) + scatter * (0.5 + 0.5 * Math.sin(p.r * 5.3));
        const orb = form.disperse * 0.5 * Math.sin(wavePhase * 0.8 + (extra > 1 ? p.r : p.x * 1.2));
        // onda que sai do centro: amplitude e velocidade acompanham a fala
        const rip = 1;
        const bx = p.x * open * rip - p.y * orb * 0.25;
        const by = p.y * open * rip + p.x * orb * 0.25;
        const ph = extra > 1 ? p.x * 1.1 + p.y * 0.9 : p.x * 2.2 + p.y * 1.8; // marca: fase espacial (fluido); poeira: aleatória
        // sem tremor: só a poeira distante se desloca de leve
        const wob = extra > 1 ? amp * 0.5 * extra : 0;
        const x0 = bx + Math.sin(ph + wavePhase * 1.3) * wob;
        const y0 = by + Math.cos(ph + wavePhase * 1.1) * wob;
        const x1 = x0 * cyaw + z0 * syaw;
        const z1 = -x0 * syaw + z0 * cyaw;
        const y2 = y0 * cp - z1 * sp;
        const z2 = y0 * sp + z1 * cp;
        const f = 3.6 / (3.6 - z2); // perspectiva forte: quem vem para a frente cresce e se afasta do centro
        return { sx: cx + x1 * scale * f, sy: cy + y2 * scale * f, f, z: z2 };
      };

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = place(p, 1);
        const sz = 1.15 * q.f * (small ? 1.25 : 1);
        let bi = Math.max(0, Math.min(BUCKETS - 1, Math.floor((p.k * 0.8 + (q.z + 0.4) * 0.35) * BUCKETS)));
        let sz2 = sz;
        if (form.scan > 0.05) {
          const band = Math.sin(t * 2.4) * 0.55;
          if (Math.abs(p.y - band) < 0.11) {
            bi = BUCKETS - 1;
            sz2 = sz * (1 + form.scan * 0.9);
          }
        }
        buckets[bi].push(q.sx, q.sy, sz2);
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
