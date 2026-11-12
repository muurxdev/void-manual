import React, { useEffect, useRef } from 'react';
import type { VoiceState } from './Particles';
import { stageOf, type Stage } from './VoidParticles';

interface Props {
  state: VoiceState;
  stage?: Stage;
  /** incrementa a cada palavra falada/ouvida (só mede o ritmo; não bate) */
  pulse: number;
  dark?: boolean;
  className?: string;
  /** altura do centro, de 0 (topo) a 1 (base) */
  centerY?: number;
}

// forma-alvo por estágio: velocidade dos reflexos, abertura, tamanho, anéis de onda, varredura, brilho
const FORMS: Record<Stage, { speed: number; spread: number; size: number; rings: number; sheen: number; glow: number }> = {
  idle: { speed: 0.22, spread: 0.55, size: 1, rings: 0, sheen: 0, glow: 0.3 },
  listen: { speed: 0.5, spread: 0.7, size: 1.05, rings: 1, sheen: 0, glow: 0.5 },
  read: { speed: 0.45, spread: 0.6, size: 1, rings: 0, sheen: 1, glow: 0.45 },
  search: { speed: 1.1, spread: 0.95, size: 0.97, rings: 0, sheen: 0, glow: 0.55 },
  diagnose: { speed: 2.1, spread: 0.18, size: 0.88, rings: 0, sheen: 0, glow: 0.9 },
  speak: { speed: 0.6, spread: 0.8, size: 1.03, rings: 0.8, sheen: 0, glow: 0.65 },
};

const COLORS = ['#ff8fc7', '#a98bff', '#7fd0ff', '#8ff0cf', '#ffc99a'];

/**
 * Bolha de vidro iridescente: reflexos pastel que fluem por dentro, aro de luz e brilho de canto.
 * Muda de forma conforme o Void ouve, lê, procura, diagnostica e fala. Tudo em curvas lentas.
 */
export const VoidBubble: React.FC<Props> = ({ state, stage, pulse, dark = false, className, centerY = 0.4 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ stage: stage ?? stageOf(state), dark, cy: centerY, rate: 2.6, lastAt: 0, last: pulse });
  live.current.stage = stage ?? stageOf(state);
  live.current.dark = dark;
  live.current.cy = centerY;

  useEffect(() => {
    if (pulse === live.current.last) return;
    live.current.last = pulse;
    const now = performance.now();
    if (live.current.lastAt) {
      const gap = (now - live.current.lastAt) / 1000;
      if (gap > 0.08 && gap < 1.5) live.current.rate += (1 / gap - live.current.rate) * 0.3;
    }
    live.current.lastAt = now;
  }, [pulse]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
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
    const form = { ...FORMS.idle };
    let phase = 0; // fase dos reflexos (velocidade variável, por isso integrada)
    let ringPhase = 0;
    let level = 0; // intensidade da fala, sobe e desce devagar
    let appear = reduce ? 1 : 0; // a bolha se forma ao aparecer
    const seeds = COLORS.map((_, i) => ({ a: i * 1.26, b: i * 0.83 + 1, sp: 0.7 + i * 0.17 }));
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = live.current;
      const tf = FORMS[s.stage];
      const k = 1 - Math.pow(0.001, dt); // suavização independente da taxa de quadros
      form.speed += (tf.speed - form.speed) * k * 0.9;
      form.spread += (tf.spread - form.spread) * k * 0.9;
      form.size += (tf.size - form.size) * k * 0.9;
      form.rings += (tf.rings - form.rings) * k * 0.9;
      form.sheen += (tf.sheen - form.sheen) * k * 0.9;
      form.glow += (tf.glow - form.glow) * k * 0.9;
      appear = Math.min(1, appear + dt * 0.9);
      const ap = 1 - Math.pow(1 - appear, 3);

      const talking = s.stage === 'speak' && now - s.lastAt < 1100;
      const lvTarget = s.stage === 'speak' ? (talking ? Math.min(1, 0.3 + s.rate / 5) : 0.2) : 0;
      level += (lvTarget - level) * Math.min(1, dt * 2.2);
      phase += dt * (form.speed + (s.stage === 'speak' ? s.rate * 0.12 * (0.4 + level) : 0));
      ringPhase += dt * (0.55 + level * 0.9);

      const t = now / 1000;
      const R = Math.min(w * 0.28, h * 0.2) * form.size * (0.55 + 0.45 * ap) * (1 + Math.sin(t * 0.9) * 0.012 + level * 0.035 * Math.sin(ringPhase * 2.2));
      const cx = w / 2;
      const cy = h * s.cy;
      const dk = s.dark;

      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = ap;

      // brilho em volta
      const halo = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.3);
      halo.addColorStop(0, dk ? `rgba(160,130,255,${0.12 + form.glow * 0.16})` : `rgba(255,150,200,${0.1 + form.glow * 0.2})`);
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(cx - R * 2.3, cy - R * 2.3, R * 4.6, R * 4.6);

      // anéis de onda (ouvindo e falando): saem da bolha e se apagam
      if (form.rings > 0.03) {
        for (let i = 0; i < 3; i++) {
          const q = (ringPhase * 0.5 + i / 3) % 1;
          ctx.beginPath();
          ctx.arc(cx, cy, R * (1.02 + q * 0.7), 0, Math.PI * 2);
          ctx.strokeStyle = dk ? `rgba(220,210,255,${(1 - q) * 0.28 * form.rings})` : `rgba(180,140,255,${(1 - q) * 0.32 * form.rings})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // corpo de vidro
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      const body = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.3, R * 0.1, cx, cy, R);
      body.addColorStop(0, dk ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.75)');
      body.addColorStop(1, dk ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.2)');
      ctx.fillStyle = body;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

      // reflexos iridescentes que fluem por dentro
      ctx.globalCompositeOperation = dk ? 'lighter' : 'source-over';
      COLORS.forEach((c, i) => {
        const sd = seeds[i];
        const ang = sd.a + phase * sd.sp;
        const ang2 = sd.b - phase * sd.sp * 0.7;
        const dist = R * form.spread * (0.62 + 0.36 * Math.sin(ang2));
        const bx = cx + Math.cos(ang) * dist;
        const by = cy + Math.sin(ang) * dist * 0.9;
        const br = R * (0.62 + 0.14 * Math.sin(ang2 * 1.3 + i));
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
        g.addColorStop(0, c + (dk ? '88' : '99'));
        g.addColorStop(1, c + '00');
        ctx.fillStyle = g;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      });
      ctx.globalCompositeOperation = 'source-over';

      // varredura de luz (lendo)
      if (form.sheen > 0.03) {
        const sx = cx + Math.sin(t * 1.8) * R * 1.1;
        const sg = ctx.createLinearGradient(sx - R * 0.35, cy - R, sx + R * 0.35, cy + R);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, `rgba(255,255,255,${0.55 * form.sheen})`);
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      // núcleo de luz (diagnosticando)
      if (form.glow > 0.7) {
        const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6);
        cg.addColorStop(0, `rgba(255,255,255,${(form.glow - 0.7) * 1.8})`);
        cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      }

      // aro de luz (fresnel): borda mais clara por dentro
      const fr = ctx.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
      fr.addColorStop(0, 'rgba(255,255,255,0)');
      fr.addColorStop(1, dk ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)');
      ctx.fillStyle = fr;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();

      // contorno fino e brilho especular do canto
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, dk ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.95)');
      rim.addColorStop(0.5, dk ? 'rgba(255,255,255,0.12)' : 'rgba(200,170,255,0.35)');
      rim.addColorStop(1, dk ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)');
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = rim;
      ctx.lineWidth = Math.max(1.5, R * 0.025);
      ctx.stroke();

      ctx.save();
      ctx.translate(cx - R * 0.38, cy - R * 0.5);
      ctx.rotate(-0.55);
      ctx.scale(1, 0.5);
      const sp = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.3);
      sp.addColorStop(0, 'rgba(255,255,255,0.95)');
      sp.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sp;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const onVis = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
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
