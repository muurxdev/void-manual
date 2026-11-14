import React, { useEffect, useRef } from 'react';
import type { Stage } from './VoidParticles';

interface Props {
  stage: Stage;
  /** incrementa a cada palavra falada ou ouvida: dá um impulso no orbe */
  pulse: number;
  className?: string;
}

type V3 = [number, number, number];

// três cores do orbe em cada estágio
const PALETTE: Record<Stage, [V3, V3, V3]> = {
  idle: [[0.06, 0.22, 0.95], [0.45, 0.2, 0.98], [0.55, 0.85, 1]],
  listen: [[0.0, 0.62, 0.95], [0.1, 0.9, 0.9], [0.85, 0.98, 1]],
  read: [[0.35, 0.35, 1], [0.7, 0.6, 1], [0.95, 0.95, 1]],
  search: [[0.5, 0.15, 0.95], [0.95, 0.25, 0.7], [0.45, 0.6, 1]],
  diagnose: [[1, 0.45, 0.08], [1, 0.75, 0.25], [1, 0.95, 0.8]],
  speak: [[0.1, 0.4, 1], [0.95, 0.35, 0.8], [0.55, 0.95, 1]],
};

// energy: tamanho da ondulação · flow: velocidade do fluido · ring: arco de luz girando · size: tamanho do orbe
const PARAMS: Record<Stage, { energy: number; flow: number; ring: number; size: number }> = {
  idle: { energy: 0.25, flow: 0.5, ring: 0, size: 1 },
  listen: { energy: 0.75, flow: 1.1, ring: 0, size: 1.04 },
  read: { energy: 0.3, flow: 1.7, ring: 1, size: 0.97 },
  search: { energy: 0.5, flow: 2.4, ring: 0.6, size: 0.95 },
  diagnose: { energy: 0.35, flow: 1.4, ring: 1, size: 0.88 },
  speak: { energy: 0.9, flow: 1.0, ring: 0, size: 1.03 },
};

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision highp float;
uniform vec2 res;
uniform float time, energy, flow, ring, size, level, spin;
uniform vec3 c1, c2, c3;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.02 + 7.3; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * res) / min(res.x, res.y);
  float R = 0.4 * size * (1.0 + level * 0.06);
  float ang = atan(uv.y, uv.x);
  // a borda ondula com a energia
  float wob = 1.0 + energy * 0.035 * sin(ang * 3.0 + time * 1.7 * flow) + energy * 0.02 * sin(ang * 5.0 - time * 2.3 * flow) + level * 0.03 * sin(ang * 4.0 + time * 6.0);
  float d = length(uv) / (R * wob);
  float t = time * 0.18 * flow;

  // fluido: ruído deformado por ele mesmo
  vec2 p = uv / R;
  float cs = cos(spin), sn = sin(spin);
  p = mat2(cs, -sn, sn, cs) * p;
  vec2 q = vec2(fbm(p * 1.5 + t), fbm(p * 1.5 + vec2(5.2, 1.3) - t * 0.8));
  float f = fbm(p * 1.3 + 2.2 * q + t * 0.5);
  vec3 col = mix(c1, c2, smoothstep(0.25, 0.75, f));
  col = mix(col, c3, smoothstep(0.35, 0.95, q.x * 0.9 + f * 0.4) * 0.8);

  // volume: mais escuro no miolo e luz na borda, como uma esfera de vidro
  float depth = smoothstep(0.0, 1.0, d);
  col *= 0.55 + 0.6 * depth;
  col += c3 * pow(clamp(d, 0.0, 1.0), 4.0) * 0.55;
  // reflexo no alto, à esquerda
  float hl = exp(-pow(length(uv / R - vec2(-0.38, 0.5)) * 1.7, 2.0));
  col += vec3(1.0) * hl * 0.42;

  // arco de luz girando na borda (lendo, procurando, diagnosticando)
  float a2 = mod(ang - time * 2.4 * flow, 6.2832);
  float arc = smoothstep(2.2, 0.0, a2) * smoothstep(0.7, 1.0, d) * smoothstep(1.06, 0.98, d);
  col += vec3(1.0) * arc * ring * 0.9;

  float mask = smoothstep(1.0, 0.975, d);
  // brilho de fora
  float glow = exp(-max(d - 1.0, 0.0) * 3.4) * (1.0 - mask) * (0.32 + energy * 0.28 + level * 0.25);
  vec3 outc = col * mask + c2 * glow;
  float alpha = max(mask, glow * 0.9);
  gl_FragColor = vec4(outc, alpha);
}`;

/**
 * Orbe do Void Voice: uma esfera de vidro com fluido colorido por dentro, reflexo e brilho em volta.
 * O fluido acelera, muda de cor e de tamanho conforme o estágio (ouvindo, lendo, procurando,
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
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: true });
    if (!gl) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = { res: U('res'), time: U('time'), energy: U('energy'), flow: U('flow'), ring: U('ring'), size: U('size'), level: U('level'), spin: U('spin'), c1: U('c1'), c2: U('c2'), c3: U('c3') };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fit = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const cur = { ...PARAMS.idle, size: 0.4 };
    const col: [V3, V3, V3] = [[...PALETTE.idle[0]], [...PALETTE.idle[1]], [...PALETTE.idle[2]]];
    let time = 0;
    let spin = 0;
    let raf = 0;
    let lastT = performance.now();
    let appear = reduce ? 1 : 0;

    const draw = (now: number) => {
      const dt = Math.min(0.12, (now - lastT) / 1000);
      lastT = now;
      const s = live.current;
      const tp = PARAMS[s.stage];
      const tc = PALETTE[s.stage];
      const k = 1 - Math.pow(0.02, dt);
      cur.energy += (tp.energy - cur.energy) * k;
      cur.flow += (tp.flow - cur.flow) * k;
      cur.ring += (tp.ring - cur.ring) * k;
      cur.size += (tp.size - cur.size) * k;
      for (let i = 0; i < 3; i++) for (let c = 0; c < 3; c++) col[i][c] += (tc[i][c] - col[i][c]) * k;
      s.level *= Math.pow(0.1, dt);
      appear = Math.min(1, appear + dt * 1.1);
      const ap = 1 - Math.pow(1 - appear, 3);
      if (!reduce) {
        time += dt;
        spin += dt * 0.05 * cur.flow;
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, time);
      gl.uniform1f(u.energy, cur.energy);
      gl.uniform1f(u.flow, cur.flow);
      gl.uniform1f(u.ring, cur.ring);
      gl.uniform1f(u.size, cur.size * (0.55 + 0.45 * ap));
      gl.uniform1f(u.level, s.level);
      gl.uniform1f(u.spin, spin);
      gl.uniform3f(u.c1, col[0][0], col[0][1], col[0][2]);
      gl.uniform3f(u.c2, col[1][0], col[1][1], col[1][2]);
      gl.uniform3f(u.c3, col[2][0], col[2][1], col[2][2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
