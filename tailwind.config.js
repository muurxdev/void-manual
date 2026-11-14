/** @type {import('tailwindcss').Config} */
const v = (n) => `rgb(var(--${n}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      colors: {
        ink: v('ink'),
        mute: v('mute'),
        sub: v('sub'),
        paper: v('paper'),
        surface: v('surface'),
        hair: v('hair'),
        fill: v('fill'),
        bubble: v('bubble'),
        assistant: v('assistant'),
      },
      // escala tipográfica única do app: 12 · 13 · 15 · 20 · 26 · 34
      fontSize: {
        caption: ['12px', { lineHeight: '16px' }],
        small: ['13px', { lineHeight: '18px' }],
        body: ['15px', { lineHeight: '22px' }],
        title: ['20px', { lineHeight: '26px', letterSpacing: '-0.01em' }],
        heading: ['26px', { lineHeight: '30px', letterSpacing: '-0.02em' }],
        display: ['34px', { lineHeight: '38px', letterSpacing: '-0.02em' }],
      },
      // movimento único: toda transição usa a mesma duração e curva
      transitionDuration: { DEFAULT: '280ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(.16, 1, .3, 1)' },
      keyframes: {
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
      },
      animation: {
        blink: 'blink 1s steps(1) infinite',
      },
    },
  },
  plugins: [],
}
