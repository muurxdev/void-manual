import React, { useEffect, useRef } from 'react';
import type { VoiceState } from './Particles';
import { stageOf, type Stage } from './VoidParticles';

interface Props {
  state: VoiceState;
  stage?: Stage;
  /** incrementa a cada palavra falada/ouvida (só mede o ritmo; não bate) */
  pulse: number;
  dark?: boolean;
  /** classes do arco de luz (fundo da tela) */
  arcClass?: string;
  /** canvas da onda, que fica dentro do cartão da tela */
  waveRef: React.RefObject<HTMLCanvasElement | null>;
}

// forma-alvo por estágio: altura da onda, velocidade, número de linhas visíveis, varredura, brilho do arco
const FORMS: Record<Stage, { amp: number; speed: number; lines: number; scan: number; arc: number }> = {
  idle: { amp: 0.36, speed: 0.85, lines: 5, scan: 0, arc: 0.5 },
  listen: { amp: 0.45, speed: 1.1, lines: 5, scan: 0, arc: 0.65 },
  read: { amp: 0.3, speed: 0.9, lines: 4, scan: 1, arc: 0.65 },
  search: { amp: 0.42, speed: 1.9, lines: 6, scan: 0, arc: 0.75 },
  diagnose: { amp: 0.07, speed: 2.4, lines: 2, scan: 0, arc: 1 },
  speak: { amp: 0.55, speed: 1.0, lines: 5, scan: 0, arc: 0.8 },
};

/**
 * Arco de luz atrás do cartão e onda luminosa dentro dele. Tudo em curvas lentas e contínuas;
 * muda conforme o Void ouve, lê, procura, diagnostica e fala (altura e velocidade seguem o ritmo da fala).
 */
export const VoidWave: React.FC<Props> = ({ state, stage, pulse, dark = true, arcClass, waveRef }) => {
  const arcRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ stage: stage ?? stageOf(state), dark, rate: 2.6, lastAt: 0, last: pulse });
  live.current.stage = stage ?? stageOf(state);
  live.current.dark = dark;

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
    const arc = arcRef.current;
    const wave = waveRef.current;
    const actx = arc?.getContext('2d');
    const wctx = wave?.getContext('2d');
    if (!arc || !wave || !actx || !wctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const size = { aw: 0, ah: 0, ww: 0, wh: 0 };
    let redraw: (() => void) | null = null;
    const fit = () => {
      size.aw = arc.clientWidth;
      size.ah = arc.clientHeight;
      size.ww = wave.clientWidth;
      size.wh = wave.clientHeight;
      arc.width = Math.round(size.aw * dpr);
      arc.height = Math.round(size.ah * dpr);
      wave.width = Math.round(size.ww * dpr);
      wave.height = Math.round(size.wh * dpr);
      actx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // mudar o tamanho do canvas apaga o desenho: redesenha na hora, antes de pintar, para a onda nunca sumir
      redraw?.();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(arc);
    ro.observe(wave);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const form = { amp: 0.36, speed: 0.85, lines: 5, scan: 0, arc: 0.5 };
    let phase = 0;
    let level = 0;
    let appear = reduce ? 1 : 0;
    let last = performance.now();
    let raf = 0;
    const LINES = [
      { f: 1.0, p: 0, a: 1.0, w: 2.2 },
      { f: 1.6, p: 1.3, a: 0.75, w: 1.5 },
      { f: 2.3, p: 2.6, a: 0.55, w: 1.2 },
      { f: 0.7, p: 3.9, a: 0.85, w: 1.4 },
      { f: 3.1, p: 5.1, a: 0.4, w: 1 },
      { f: 1.2, p: 0.7, a: 0.6, w: 1 },
    ];

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const s = live.current;
      const tf = FORMS[s.stage];
      const k = (1 - Math.pow(0.001, dt)) * 0.9;
      form.amp += (tf.amp - form.amp) * k;
      form.speed += (tf.speed - form.speed) * k;
      form.lines += (tf.lines - form.lines) * k;
      form.scan += (tf.scan - form.scan) * k;
      form.arc += (tf.arc - form.arc) * k;
      appear = Math.min(1, appear + dt * 1.1);
      const ap = 1 - Math.pow(1 - appear, 3);

      // intensidade da fala: sobe e desce devagar, proporcional ao ritmo das palavras
      const talking = (s.stage === 'speak' || s.stage === 'listen') && now - s.lastAt < 1100;
      const lvT = s.stage === 'speak' || s.stage === 'listen' ? (talking ? Math.min(1, 0.3 + s.rate / 5) : 0.2) : 0;
      level += (lvT - level) * Math.min(1, dt * 2.2);
      phase += dt * (form.speed + (s.stage === 'speak' ? s.rate * 0.22 * (0.4 + level) : 0));
      const t = now / 1000;
      const dk = s.dark;

      /* ---- arco de luz (desligado quando o canvas está oculto) ---- */
      if (arc.clientWidth > 0) {
        const w = size.aw;
        const h = size.ah;
        actx.clearRect(0, 0, w, h);
        actx.globalAlpha = ap;
        const cx = w / 2;
        const cy = h * 1.02;
        const r = Math.min(w * 0.98, h * 0.74) * (1 + level * 0.025);
        const g = form.arc * (0.8 + level * 0.5 + Math.sin(t * 0.8) * 0.06);
        actx.lineCap = 'round';
        const layers = [
          { lw: w * 0.2, al: 0.16 },
          { lw: w * 0.1, al: 0.28 },
          { lw: w * 0.045, al: 0.5 },
          { lw: w * 0.012, al: 0.95 },
        ];
        for (const L of layers) {
          const grad = actx.createLinearGradient(cx - r, cy, cx + r, cy - r);
          const c = dk ? '255,255,255' : '20,20,20';
          grad.addColorStop(0, 'rgba(' + c + ',0)');
          grad.addColorStop(0.5, 'rgba(' + c + ',' + L.al * g + ')');
          grad.addColorStop(1, 'rgba(' + c + ',0)');
          actx.strokeStyle = grad;
          actx.lineWidth = L.lw;
          actx.beginPath();
          actx.arc(cx, cy, r, Math.PI * 1.06, Math.PI * 1.94);
          actx.stroke();
        }
        actx.globalAlpha = 1;
      }

      /* ---- onda luminosa ---- */
      {
        const w = size.ww;
        const h = size.wh;
        wctx.clearRect(0, 0, w, h);
        wctx.globalAlpha = ap;
        const cy = h / 2;
        const amp = (form.amp * (0.78 + 0.22 * Math.sin(t * 0.7)) + (s.stage === 'speak' || s.stage === 'listen' ? level * 0.28 : 0)) * h * 0.5; // parado, ela continua viva
        const n = Math.round(form.lines);
        for (let li = 0; li < LINES.length; li++) {
          const L = LINES[li];
          const vis = Math.max(0, Math.min(1, form.lines - li));
          if (vis <= 0.01) continue;
          wctx.beginPath();
          const step = 3;
          for (let x = 0; x <= w; x += step) {
            const u = x / w;
            const env = Math.pow(Math.sin(Math.PI * u), 2); // some nas pontas
            const y = cy + env * amp * L.a * Math.sin(u * 7 * L.f + phase * (1 + li * 0.18) + L.p) * (0.7 + 0.3 * Math.sin(u * 3 + phase * 0.5 + li));
            if (x === 0) wctx.moveTo(x, y);
            else wctx.lineTo(x, y);
          }
          const alpha = (li === 0 ? 0.95 : 0.55) * vis;
          wctx.strokeStyle = dk ? 'rgba(255,255,255,' + alpha + ')' : 'rgba(17,17,17,' + alpha + ')';
          wctx.lineWidth = L.w;
          wctx.shadowColor = dk ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.25)';
          wctx.shadowBlur = li === 0 ? 14 : 8;
          wctx.stroke();
        }
        wctx.shadowBlur = 0;
        // varredura de luz (lendo a pergunta)
        if (form.scan > 0.03) {
          const sx = ((Math.sin(t * 1.6) + 1) / 2) * w;
          const sg = wctx.createLinearGradient(sx - w * 0.18, 0, sx + w * 0.18, 0);
          const c2 = dk ? '255,255,255' : '17,17,17';
          sg.addColorStop(0, 'rgba(' + c2 + ',0)');
          sg.addColorStop(0.5, 'rgba(' + c2 + ',' + 0.35 * form.scan + ')');
          sg.addColorStop(1, 'rgba(' + c2 + ',0)');
          wctx.fillStyle = sg;
          wctx.fillRect(0, cy - h * 0.3, w, h * 0.6);
        }
        void n;
        wctx.globalAlpha = 1;
      }

    };
    const draw = (now: number) => {
      frame(now);
      raf = requestAnimationFrame(draw);
    };
    redraw = () => frame(performance.now());
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

  return (
    <>
      <canvas ref={arcRef} className={arcClass} aria-hidden="true" />
    </>
  );
};
