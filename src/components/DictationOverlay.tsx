import React, { useEffect, useRef } from 'react';
import { ArrowLeft, Mic, Square, Trash2 } from 'lucide-react';
import { DictationWave } from './DictationWave';

interface Props {
  text: string;
  level: number;
  onCancel: () => void;
  /** para de ouvir e devolve o texto ao campo do chat, pronto para enviar */
  onFinish: () => void;
}

/** Tela cheia de ditado: o texto aparece grande enquanto a pessoa fala, com o microfone pulsando e a onda embaixo. */
export const DictationOverlay: React.FC<Props> = ({ text, level, onCancel, onFinish }) => {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
  }, [text]);

  return (
    <div className="anim-fade-in absolute inset-0 z-50 flex flex-col bg-paper" role="dialog" aria-label="Ditado por voz">
      <header className="safe-top flex items-center justify-between pb-2" style={{ paddingInline: 'clamp(16px, 5.6vw, 40px)' }}>
        <button onClick={onCancel} aria-label="Cancelar ditado" className="icon-btn glass loop-border">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span aria-hidden="true" />
      </header>

      <div
        ref={box}
        className="scroll-smooth-area min-h-0 flex-1"
        style={{ paddingInline: 'clamp(22px, 7vw, 44px)', maskImage: 'linear-gradient(to bottom, transparent 0, #000 90px)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 90px)' }}
        aria-live="polite"
      >
        <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col justify-end pb-6 pt-16">
          <p className="text-heading font-medium break-words">{text || <span className="text-mute">Pode falar…</span>}</p>
        </div>
      </div>

      <p className="text-center text-small text-sub">Ouvindo…</p>

      <div className="relative mx-auto my-5 flex h-[168px] w-[168px] items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full bg-ink/[0.04] transition-transform duration-300" style={{ transform: 'scale(' + (1 + level * 0.14) + ')' }} />
        <span className="absolute inset-[22px] rounded-full bg-ink/[0.06] transition-transform duration-300" style={{ transform: 'scale(' + (1 + level * 0.1) + ')' }} />
        <span className="anim-ring absolute inset-[44px] rounded-full border border-ink/30" />
        <span className="glass loop-border relative flex h-[76px] w-[76px] items-center justify-center rounded-full">
          <Mic className="h-8 w-8" />
        </span>
      </div>

      <div className="flex items-center gap-4 pb-[max(env(safe-area-inset-bottom),22px)]" style={{ paddingInline: 'clamp(16px, 5.6vw, 40px)' }}>
        <button onClick={onCancel} aria-label="Descartar" className="glass loop-border press flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Trash2 className="h-5 w-5" />
        </button>
        <DictationWave level={level} className="h-10 min-w-0 flex-1 text-ink" />
        <button onClick={onFinish} aria-label="Parar e ver a transcrição" className="glass-ink loop-border press flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
          <Square className="h-[18px] w-[18px] fill-current" />
        </button>
      </div>
    </div>
  );
};
