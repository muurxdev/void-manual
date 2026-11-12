import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Ditado para o campo de texto: transcreve em tempo real (SpeechRecognition) e reinicia
 * sozinho enquanto a pessoa não parar. `level` (0..1) sobe a cada trecho reconhecido e
 * alimenta a onda.
 */
export function useDictation() {
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const rec = useRef<any>(null);
  const wanted = useRef(false);
  const finals = useRef('');
  const live = useRef('');
  const base = useRef('');

  const supported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const spawn = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let fin = '';
      let tmp = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t;
        else tmp += t;
      }
      finals.current = fin;
      live.current = `${base.current} ${fin}${tmp}`.trim();
      setText(live.current);
      setLevel(1);
    };
    r.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      wanted.current = false;
      setActive(false);
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Permita o microfone para ditar.' : 'Não consegui ouvir agora.');
    };
    r.onend = () => {
      // o navegador encerra sozinho depois de um tempo: religa enquanto o ditado estiver aberto
      if (wanted.current) {
        // o que já foi dito fica guardado e o próximo trecho se soma a ele
        base.current = live.current;
        finals.current = '';
        try {
          rec.current = spawn();
          rec.current.start();
        } catch {
          wanted.current = false;
          setActive(false);
        }
      }
    };
    return r;
  }, []);

  const start = useCallback(() => {
    setError('');
    if (!supported) {
      setError('Este navegador não reconhece voz.');
      return;
    }
    base.current = '';
    finals.current = '';
    live.current = '';
    setText('');
    wanted.current = true;
    try {
      rec.current = spawn();
      rec.current.start();
      setActive(true);
    } catch {
      wanted.current = false;
      setError('Não consegui iniciar o microfone.');
    }
  }, [spawn, supported]);

  /** encerra e devolve o texto transcrito */
  const stop = useCallback(() => {
    wanted.current = false;
    try {
      rec.current?.stop?.();
    } catch {
      /* já parado */
    }
    setActive(false);
    return live.current.trim();
  }, []);

  const cancel = useCallback(() => {
    wanted.current = false;
    try {
      rec.current?.abort?.();
    } catch {
      /* já parado */
    }
    live.current = '';
    setText('');
    setActive(false);
  }, []);

  // a onda desce sozinha entre uma palavra e outra
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setLevel((l) => Math.max(0, l - 0.12)), 60);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(
    () => () => {
      wanted.current = false;
      try {
        rec.current?.abort?.();
      } catch {
        /* nada */
      }
    },
    []
  );

  return { active, text, level, error, supported, start, stop, cancel };
}
