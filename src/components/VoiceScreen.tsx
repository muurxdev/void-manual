import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Keyboard, Mic, Square, ArrowUp, MessageSquare, FileText, X, Plus, BookOpen, Image as ImageIcon, MoreHorizontal, Info } from 'lucide-react';
import { useFeedback } from './Feedback';
import { Dropdown, type MenuItem } from './ui';
import { type VoiceState } from './Particles';
import { VoidParticles } from './VoidParticles';

interface Cite {
  title: string;
  line?: number;
}

interface VoiceScreenProps {
  status: VoiceState;
  phase: string;
  userText: string;
  replyText: string;
  error: string;
  pulse: number;
  citations: Cite[];
  dark: boolean;
  canOpenChat: boolean;
  onBack: () => void;
  onMic: () => void;
  onSendText: (text: string) => void;
  onOpenChat: () => void;
  contextTitle?: string;
  onClearContext: () => void;
  onPickLibrary: () => void;
  onSendWithAttachment: (text: string, attachment: string) => void;
}

const LABEL: Record<VoiceState, string> = {
  idle: 'Segure para falar ou toque para deixar ligado',
  listening: 'Ouvindo',
  thinking: '',
  speaking: 'Falando',
};

const TRY = ['Torque da CB 500F', 'Falha P0300', 'Folga da Lander 250'];
const GL = 'border border-ink/15 bg-ink/10 text-ink backdrop-blur-xl';

export const VoiceScreen: React.FC<VoiceScreenProps> = ({
  status,
  phase,
  userText,
  replyText,
  error,
  pulse,
  citations,
  dark,
  canOpenChat,
  onBack,
  onMic,
  onSendText,
  onOpenChat,
  contextTitle,
  onClearContext,
  onPickLibrary,
  onSendWithAttachment,
}) => {
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [draft, setDraft] = useState('');
  const [plus, setPlus] = useState(false);
  const [menu, setMenu] = useState(false);
  const fb = useFeedback();
  const [attachment, setAttachment] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const busy = status === 'thinking';

  // acompanha o texto que vai aparecendo
  useEffect(() => {
    const el = textRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [replyText, userText]);

  useEffect(() => {
    if (mode === 'text') {
      const id = window.setTimeout(() => taRef.current?.focus(), 260);
      return () => window.clearTimeout(id);
    }
  }, [mode]);

  useEffect(() => {
    const el = taRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [draft]);

  const composer = useRef<HTMLDivElement>(null);
  const hasInput = draft.trim() !== '' || attachment !== null;
  const hasInputRef = useRef(false);
  hasInputRef.current = hasInput || plus;

  // teclado descendo (ou o campo perdendo o foco) com o campo vazio: volta para o modo de falar
  useEffect(() => {
    if (mode !== 'text') return;
    const vvp = window.visualViewport;
    let opened = false;
    let timer = 0;
    const leave = () => {
      if (!hasInputRef.current) setMode('voice');
    };
    const onResize = () => {
      if (!vvp) return;
      const open = vvp.height < window.innerHeight * 0.8;
      if (open) opened = true;
      else if (opened) leave();
    };
    const onBlur = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (composer.current && composer.current.contains(document.activeElement)) return;
        leave();
      }, 220);
    };
    const ta = taRef.current;
    vvp?.addEventListener('resize', onResize);
    ta?.addEventListener('blur', onBlur);
    return () => {
      vvp?.removeEventListener('resize', onResize);
      ta?.removeEventListener('blur', onBlur);
      window.clearTimeout(timer);
    };
  }, [mode]);

  // microfone: segurar fala enquanto segura; um toque deixa ligado até tocar de novo
  const press = useRef({ t: 0, started: false });
  const micDown = () => {
    if (busy) return;
    if (status === 'idle') {
      press.current = { t: performance.now(), started: true };
      onMic();
    } else {
      press.current.started = false;
      onMic();
    }
  };
  const micUp = () => {
    if (press.current.started && performance.now() - press.current.t > 450) onMic();
    press.current.started = false;
  };
  const canSend = (draft.trim() !== '' || attachment !== null) && !busy;
  const send = () => {
    if (!canSend) return;
    const v = draft.trim();
    taRef.current?.blur(); // recolhe o teclado
    setDraft('');
    setMode('voice');
    if (attachment) {
      const a = attachment;
      setAttachment(null);
      onSendWithAttachment(v || 'Analise esta imagem.', a);
    } else onSendText(v);
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setAttachment(r.result as string);
    r.readAsDataURL(f);
    e.target.value = '';
  };
  const plusItems: MenuItem[] = [
    { key: 'lib', label: 'Da biblioteca', hint: 'Responder com um arquivo seu', icon: <BookOpen className="h-4 w-4" />, onSelect: onPickLibrary },
    { key: 'img', label: 'Foto ou imagem', hint: 'Anexar à mensagem', icon: <ImageIcon className="h-4 w-4" />, onSelect: () => fileRef.current?.click() },
    { key: 'back', label: 'Voltar', hint: 'Para a tela anterior', icon: <ArrowLeft className="h-4 w-4" />, onSelect: onBack },
  ];

  const menuItems: MenuItem[] = [
    ...(canOpenChat ? [{ key: 'chat', label: 'Ver no chat', hint: 'Abrir a conversa escrita', icon: <MessageSquare className="h-4 w-4" />, onSelect: onOpenChat }] : []),
    { key: 'lib', label: 'Usar um arquivo', hint: 'Responder com a biblioteca', icon: <BookOpen className="h-4 w-4" />, onSelect: onPickLibrary },
    {
      key: 'how',
      label: 'Como usar',
      hint: 'Segurar ou tocar no microfone',
      icon: <Info className="h-4 w-4" />,
      onSelect: () => fb.toast('Segure o microfone para falar, ou toque uma vez para deixar ligado e toque de novo para parar.', 'info'),
    },
  ];

  const label = status === 'thinking' ? phase : error ? '' : LABEL[status];
  const words = userText.split(' ').filter(Boolean);
  const splitAt = status === 'listening' ? Math.max(0, words.length - 4) : words.length;
  const side = 'clamp(16px,5.6vw,40px)';

  return (
    <div className="relative flex h-full flex-col overflow-hidden text-ink" style={{ background: dark ? 'radial-gradient(120% 70% at 50% 28%, #161616 0%, #070707 62%, #000 100%)' : 'radial-gradient(120% 70% at 50% 28%, #ffffff 0%, #f6f6f6 62%, #ececec 100%)' }}>
      <header className="safe-top relative z-20 grid grid-cols-[48px_1fr_48px] items-center" style={{ paddingInline: side }}>
        <button onClick={onBack} aria-label="Voltar" className="icon-btn glass">
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <h1 className="glass mx-auto rounded-full px-5 py-2 text-[15px] font-medium">Void Voice</h1>
        <div className="relative justify-self-end">
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Ações e informações"
            aria-haspopup="menu"
            aria-expanded={menu}
            className="icon-btn glass"
          >
            <MoreHorizontal className="h-[18px] w-[18px]" />
          </button>
          <Dropdown open={menu} onClose={() => setMenu(false)} items={menuItems} placement="bottom-end" />
        </div>
      </header>

      {/* a marca vira uma nuvem de pontos viva, no meio da tela */}
      <VoidParticles state={status} pulse={pulse} dark={dark} className="pointer-events-none absolute inset-0 z-0 h-full w-full" />

      <p
        className="absolute inset-x-0 z-10 flex h-5 items-center justify-center gap-1.5 text-[13px] text-ink/55"
        style={{ top: 'calc(50% + min(27vw, 16.2vh) + 14px)' }}
        aria-live="polite"
      >
        {label}
        {(status === 'listening' || status === 'speaking' || status === 'thinking') && (
          <span className="inline-flex gap-0.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="anim-orb h-1 w-1 rounded-full bg-ink/60" style={{ animationDelay: `${i * 160}ms` }} />
            ))}
          </span>
        )}
      </p>

      {/* o que foi dito e a resposta, palavra por palavra */}
      <div
        ref={textRef}
        className="scroll-smooth-area absolute inset-x-0 z-10 mx-auto w-full max-w-[640px] px-[clamp(22px,7vw,44px)] pb-3"
        style={{ top: 'calc(50% + min(27vw, 16.2vh) + 44px)', bottom: 128, maskImage: 'linear-gradient(to bottom, transparent 0, #000 16px, #000 calc(100% - 16px), transparent)' }}
        aria-live="polite"
      >
        {error ? (
          <p className="anim-fade-in text-center text-[15px] text-ink/60">{error}</p>
        ) : !userText && !replyText && status === 'idle' ? (
          <div className="anim-fade-up flex flex-col items-center gap-1.5">
            <p className="text-[12px] uppercase tracking-wider text-ink/45">Experimente perguntar</p>
            <div className="flex flex-wrap justify-center gap-2">
              {TRY.map((t) => (
                <button key={t} onClick={() => onSendText(t)} className="glass press min-h-11 rounded-full px-4 text-[13px]">
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {userText && (
              <p className="text-center text-[clamp(20px,1.6vw+14px,28px)] font-semibold leading-[1.25] tracking-[-0.01em]">
                <span className="text-ink">{words.slice(0, splitAt).join(' ')} </span>
                <span className="text-ink/30">{words.slice(splitAt).join(' ')}</span>
              </p>
            )}
            {replyText && (
              <div className="anim-fade-up mt-5 rounded-[22px] border border-ink/10 bg-ink/[0.06] px-4 py-3.5 backdrop-blur-xl">
                <p className="text-[15px] leading-relaxed text-ink/90">
                  {replyText}
                  {status === 'speaking' && <span className="ml-0.5 inline-block h-4 w-[2px] animate-blink bg-ink align-middle" />}
                </p>
                {status !== 'speaking' && canOpenChat && (
                  <button onClick={onOpenChat} className="glass press mt-3 flex min-h-11 items-center gap-2 rounded-full px-4 text-[13px] font-medium">
                    <MessageSquare className="h-4 w-4" /> Continuar no chat
                  </button>
                )}
                {status !== 'speaking' && citations.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-ink/10 pt-2.5">
                    {citations.slice(0, 3).map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-1 text-[12px] text-ink/70">
                        <FileText className="h-3 w-3" />
                        {c.title.length > 26 ? c.title.slice(0, 26) + '…' : c.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* controles: voz e texto trocam de lugar com animação */}
      <div className="absolute inset-x-0 bottom-0 z-10 h-[116px]">
        <div
          className={`absolute bottom-[max(env(safe-area-inset-bottom),16px)] left-1/2 flex w-full max-w-[420px] -translate-x-1/2 items-center justify-between transition-all duration-[380ms] ${
            mode === 'voice' ? 'opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
          }`}
          style={{ transitionTimingFunction: 'var(--spring)', paddingInline: 'clamp(28px,10vw,56px)' }}
        >
          <button onClick={() => setMode('text')} aria-label="Escrever" className="glass press flex h-[52px] w-[52px] items-center justify-center rounded-full">
            <Keyboard className="h-5 w-5" />
          </button>
          <button
            onPointerDown={micDown}
            onPointerUp={micUp}
            onPointerCancel={micUp}
            onClick={(e) => e.detail === 0 && onMic()}
            disabled={busy}
            aria-label={status === 'listening' ? 'Parar de ouvir' : status === 'speaking' ? 'Interromper' : 'Falar'}
            className={`glass-ink press relative flex h-[72px] w-[72px] items-center justify-center rounded-full ${busy ? 'opacity-60' : ''}`}
           
          >
            {status === 'listening' && <span className="anim-ring absolute inset-0 rounded-full border border-ink/50" />}
            {status === 'speaking' ? <Square className="h-6 w-6 fill-current" /> : <Mic className="h-8 w-8" />}
          </button>
          <button onClick={onPickLibrary} aria-label="Usar um arquivo da biblioteca" className="glass press flex h-[52px] w-[52px] items-center justify-center rounded-full">
            <BookOpen className="h-5 w-5" />
          </button>
        </div>

        <div
          className={`absolute bottom-[max(env(safe-area-inset-bottom),16px)] left-1/2 flex w-full max-w-[640px] -translate-x-1/2 flex-col gap-2 transition-all duration-[380ms] ${
            mode === 'text' ? 'opacity-100' : 'pointer-events-none translate-y-8 opacity-0'
          }`}
          style={{ transitionTimingFunction: 'var(--spring)', paddingInline: side }}
        >
          {(contextTitle || attachment) && (
            <div className="flex flex-wrap items-center gap-2">
              {contextTitle && (
                <span className={`flex max-w-full items-center gap-2 rounded-full py-1.5 pl-3.5 pr-1.5 text-[12px] ${GL}`}>
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Usando {contextTitle}</span>
                  <button onClick={onClearContext} aria-label="Remover contexto" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/15">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {attachment && (
                <span className="relative inline-block">
                  <img src={attachment} alt="Prévia do anexo" className="h-14 w-14 rounded-xl border border-ink/15 object-cover" />
                  <button onClick={() => setAttachment(null)} aria-label="Remover anexo" className="absolute -right-2.5 -top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          )}
          <div ref={composer} className="flex items-end gap-2">
            <div className="relative">
              <button
                onClick={() => setPlus((p) => !p)}
                aria-label="Adicionar"
                aria-haspopup="menu"
                aria-expanded={plus}
                tabIndex={mode === 'text' ? 0 : -1}
                className="glass press flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full"
              >
                <Plus className={`h-5 w-5 transition-transform duration-500 ${plus ? 'rotate-45' : ''}`} />
              </button>
              <Dropdown open={plus} onClose={() => setPlus(false)} items={plusItems} placement="top-start" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <div className="glass flex min-h-[52px] min-w-0 flex-1 items-center rounded-[26px] pl-4 pr-2">
              <label htmlFor="voice-text" className="sr-only">
                Escrever para o Void
              </label>
              <textarea
                id="voice-text"
                ref={taRef}
                rows={1}
                value={draft}
                tabIndex={mode === 'text' ? 0 : -1}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Escreva aqui…"
                className="max-h-[120px] min-w-0 flex-1 resize-none border-0 bg-transparent py-3.5 text-[15px] leading-snug text-ink placeholder:text-ink/40 focus:outline-none"
              />
            </div>
            <button
              onClick={send}
              disabled={!canSend}
              aria-label="Enviar"
              tabIndex={mode === 'text' ? 0 : -1}
              className="glass-ink press flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full disabled:opacity-40"
             
            >
              <ArrowUp className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
