/**
 * Voz de resposta do Void.
 * Usa a síntese do navegador (sem custo, sem instalar nada) e escolhe sozinho a melhor
 * voz pt-BR disponível. O ponto de troca para uma voz clonada (Fish Audio / ElevenLabs)
 * é `speakText`: basta tocar o áudio remoto e disparar `onWord` pelo tempo de cada palavra.
 */

export interface VoicePrefs {
  enabled: boolean;
  voiceURI: string; // '' = automática
  rate: number;
}

const KEY = 'void_web_voice';
const DEFAULTS: VoicePrefs = { enabled: true, voiceURI: '', rate: 1 };

export function loadPrefs(): VoicePrefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

export function savePrefs(p: VoicePrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sem storage */
  }
}

export function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve([]);
    const pick = () => window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('pt'));
    const now = pick();
    if (now.length) return resolve(now);
    const done = () => resolve(pick());
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    window.setTimeout(done, 1500);
  });
}

const score = (v: SpeechSynthesisVoice) => {
  let s = 0;
  if (/natural|neural/i.test(v.name)) s += 5;
  if (/online/i.test(v.name)) s += 3;
  if (/google/i.test(v.name)) s += 3;
  if (v.lang.toLowerCase() === 'pt-br') s += 4;
  if (/antonio|donato|fabio|felipe|humberto|julio|nicolau|valerio/i.test(v.name)) s += 1; // timbre grave combina com oficina
  if (v.localService) s += 1;
  return s;
};

export function pickVoice(voices: SpeechSynthesisVoice[], prefs: VoicePrefs): SpeechSynthesisVoice | undefined {
  if (prefs.voiceURI) {
    const chosen = voices.find((v) => v.voiceURI === prefs.voiceURI);
    if (chosen) return chosen;
  }
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

export interface SpeakHandle {
  cancel: () => void;
}

interface SpeakOpts {
  prefs: VoicePrefs;
  onStart?: () => void;
  /** índice (em caracteres) até onde a fala já chegou */
  onProgress: (charIndex: number) => void;
  onEnd: () => void;
}

/** Fala o texto e avisa o progresso por caractere. Sem voz disponível, simula o ritmo para o texto continuar aparecendo. */
export function speakText(text: string, opts: SpeakOpts): SpeakHandle {
  const { prefs, onStart, onProgress, onEnd } = opts;
  let finished = false;
  let reached = 0;
  let timer = 0;
  let watchdog = 0;

  const wordEnd = (i: number) => {
    const j = text.indexOf(' ', i);
    return j === -1 ? text.length : j;
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearInterval(timer);
    window.clearTimeout(watchdog);
    onProgress(text.length);
    onEnd();
  };
  // ritmo estimado (~14 caracteres/s) quando o navegador não informa as palavras
  const startTimed = () => {
    if (timer || finished) return;
    const cps = 14 * prefs.rate;
    let last = performance.now();
    timer = window.setInterval(() => {
      const now = performance.now();
      reached = Math.min(text.length, reached + ((now - last) / 1000) * cps);
      last = now;
      onProgress(wordEnd(Math.floor(reached)));
      if (reached >= text.length) finish();
    }, 90);
  };

  const canSpeak = prefs.enabled && 'speechSynthesis' in window;
  if (!canSpeak) {
    onStart?.();
    startTimed();
    return { cancel: () => ((finished = true), window.clearInterval(timer)) };
  }

  getVoices().then((voices) => {
    if (finished) return;
    const voice = pickVoice(voices, prefs);
    if (!voice) {
      onStart?.();
      startTimed();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = prefs.rate;
    u.pitch = 0.95;
    u.onstart = () => {
      onStart?.();
      // se em 700 ms nenhuma palavra for anunciada, segue pelo ritmo estimado
      watchdog = window.setTimeout(() => reached === 0 && startTimed(), 700);
    };
    u.onboundary = (e) => {
      if (finished) return;
      window.clearInterval(timer);
      timer = 0;
      reached = Math.max(reached, e.charIndex);
      onProgress(wordEnd(e.charIndex));
    };
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
  });

  return {
    cancel: () => {
      finished = true;
      window.clearInterval(timer);
      window.clearTimeout(watchdog);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    },
  };
}
