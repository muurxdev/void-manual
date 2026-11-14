import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Keyboard, Mic, Square, ArrowUp, MessageSquare, FileText, X, BookOpen, Image as ImageIcon, MoreHorizontal, Info } from 'lucide-react';
import { useFeedback } from './Feedback';
import { Dropdown, type MenuItem } from './ui';
import { type VoiceState } from '../data/types';
import { stageOf } from './VoidParticles';
import { VoidOrb } from './VoidOrb';

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
  /** perguntas e respostas anteriores desta conversa (contexto) */
  history: { q: string; a: string }[];
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

const GL = 'border border-ink/15 bg-ink/10 text-ink backdrop-blur-xl';

export const VoiceScreen: React.FC<VoiceScreenProps> = ({
  status,
  phase,
  userText,
  replyText,
  error,
  pulse,
  citations,
  history,
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
  }, [replyText, userText, status, history.length]);

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
  hasInputRef.current = hasInput;

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
  const menuItems: MenuItem[] = [
    ...(canOpenChat ? [{ key: 'chat', label: 'Ver no chat', hint: 'Abrir a conversa escrita', icon: <MessageSquare className="h-4 w-4" />, onSelect: onOpenChat }] : []),
    { key: 'img', label: 'Foto ou imagem', hint: 'Anexar à mensagem', icon: <ImageIcon className="h-4 w-4" />, onSelect: () => fileRef.current?.click() },
    { key: 'lib', label: 'Usar um arquivo', hint: 'Responder com a biblioteca', icon: <BookOpen className="h-4 w-4" />, onSelect: onPickLibrary },
    {
      key: 'how',
      label: 'Como usar',
      hint: 'Segurar ou tocar no microfone',
      icon: <Info className="h-4 w-4" />,
      onSelect: () => fb.toast('Segure o microfone para falar, ou toque uma vez para deixar ligado e toque de novo para parar.', 'info'),
    },
  ];

  const rw = replyText.split(' ');
  const cut = status === 'speaking' ? Math.max(0, rw.length - 3) : rw.length;
  const replyHead = rw.slice(0, cut).join(' ') + (cut > 0 && cut < rw.length ? ' ' : '');
  const replyTail = rw.slice(cut).join(' ');
  const side = 'clamp(16px,5.6vw,40px)';

  const orbH = mode === 'text' ? 'clamp(200px, 30dvh, 280px)' : 'clamp(320px, 48dvh, 480px)';
  const emptyIdle = !userText && !replyText && history.length === 0 && !error;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-paper text-ink">
      <header className="safe-top relative z-20 grid shrink-0 grid-cols-[48px_1fr_48px] items-center" style={{ paddingInline: side }}>
        <button onClick={onBack} aria-label="Voltar" className="icon-btn glass loop-border">
          <ArrowLeft className="h-[18px] w-[18px]" />
        </button>
        <h1 className="glass loop-border justify-self-center rounded-full px-4 py-2 text-center text-caption font-medium tracking-[0.18em]">VOID VOICE</h1>
        <div className="relative justify-self-end">
          <button onClick={() => setMenu((m) => !m)} aria-label="Ações e informações" aria-haspopup="menu" aria-expanded={menu} className="icon-btn glass loop-border">
            <MoreHorizontal className="h-[18px] w-[18px]" />
          </button>
          <Dropdown open={menu} onClose={() => setMenu(false)} items={menuItems} placement="bottom-end" />
        </div>
      </header>

      {/* o orbe: o buraco negro muda de forma a cada estágio */}
      <div className={"relative z-0 " + (emptyIdle ? "min-h-0 flex-1" : "shrink-0")} style={emptyIdle ? { marginBottom: 124 } : { height: orbH }}>
        <VoidOrb stage={stageOf(status, phase)} pulse={pulse} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>

      {/* conversa: texto grande, em níveis */}
      <div
        ref={textRef}
        className={(emptyIdle ? "hidden " : "") + "scroll-smooth-area relative z-10 min-h-0 flex-1 px-[clamp(22px,7vw,40px)]"}
        style={{ paddingBottom: mode === 'voice' ? 138 : 124, maskImage: 'linear-gradient(to bottom, transparent 0, #000 14px, #000 calc(100% - 40px), transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 14px, #000 calc(100% - 40px), transparent)' }}
        aria-live="polite"
      >
        <div className="mx-auto w-full max-w-[640px] pt-2 text-center">
          {error ? (
            <p className="anim-fade-in text-body leading-snug text-ink/60">{error}</p>
          ) : emptyIdle ? null : (
            <>
              {history.length > 0 && (
                <div className="mb-6 space-y-3">
                  {history.map((h, i) => (
                    <div key={i} className="opacity-70">
                      <p className="text-body leading-snug text-ink/50">{h.q}</p>
                      <p className="mt-0.5 text-body leading-snug text-ink/35">{h.a}</p>
                    </div>
                  ))}
                </div>
              )}
              {userText && (
                <section className="anim-fade-up">
                  <h2 className="mb-1 text-caption font-medium uppercase tracking-[0.16em] text-ink/40">Você</h2>
                  <p className="text-[clamp(19px,1.8vw+12px,25px)] font-medium leading-[1.25] tracking-[-0.01em] text-ink/55">{userText}</p>
                </section>
              )}
              {replyText && (
                <section className="anim-fade-up mt-6">
                  <h2 className="mb-1.5 text-caption font-medium uppercase tracking-[0.16em] text-ink/40">Void</h2>
                  <p className="text-[clamp(24px,3vw+12px,32px)] font-medium leading-[1.18] tracking-[-0.02em]">
                    {replyHead}
                    <span className="text-ink/50">{replyTail}</span>
                    {status === 'speaking' && <span className="ml-1 inline-block h-[0.9em] w-[3px] animate-blink bg-ink align-[-0.1em]" />}
                  </p>
                </section>
              )}
              {replyText && status !== 'speaking' && citations.length > 0 && (
                <section className="anim-fade-up mt-5">
                  <h2 className="mb-1.5 text-caption font-medium uppercase tracking-[0.16em] text-ink/40">Fontes</h2>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {citations.slice(0, 3).map((c, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2.5 py-1 text-caption text-ink/70">
                        <FileText className="h-3 w-3" />
                        {c.title.length > 26 ? c.title.slice(0, 26) + '…' : c.title}
                      </span>
                    ))}
                  </div>
                </section>
              )}
              {(replyText || history.length > 0) && status !== 'speaking' && status !== 'thinking' && (
                <div className="anim-fade-up mt-5 flex flex-wrap justify-center gap-2">
                  <button onClick={onMic} className="glass-ink press flex min-h-11 items-center gap-2 rounded-full px-4 text-small font-medium loop-border">
                    <Mic className="h-4 w-4" /> Continuar falando
                  </button>
                  {canOpenChat && (
                    <button onClick={onOpenChat} className="glass press flex min-h-11 items-center gap-2 rounded-full px-4 text-small font-medium loop-border">
                      <MessageSquare className="h-4 w-4" /> Abrir no chat
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* botões de baixo: ficam acima de qualquer camada para sempre receber o toque */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-[max(env(safe-area-inset-bottom),22px)]">
        <div
          className={'grid w-full grid-cols-[48px_1fr_48px] items-center justify-items-center transition-opacity duration-300 ' + (mode === 'voice' ? 'pointer-events-auto opacity-100' : 'invisible opacity-0')}
          style={{ touchAction: 'manipulation', paddingInline: side }}
        >
          <button onClick={() => setMode('text')} aria-label="Escrever" className="glass loop-border press flex h-12 w-12 items-center justify-center rounded-full justify-self-start">
            <Keyboard className="h-5 w-5" />
          </button>
          <button
            onPointerDown={micDown}
            onPointerUp={micUp}
            onPointerCancel={micUp}
            onClick={(e) => e.detail === 0 && onMic()}
            disabled={busy}
            aria-label={status === 'listening' ? 'Parar de ouvir' : status === 'speaking' ? 'Interromper' : 'Falar'}
            className={'loop-border press relative flex h-[92px] w-[92px] items-center justify-center rounded-full ' + (busy ? 'opacity-60' : '')}
          >
            {status === 'listening' && <span className="anim-ring absolute inset-0 rounded-full border border-ink/50" />}
            <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-ink text-paper">
              {status === 'speaking' ? <Square className="h-6 w-6 fill-current" /> : <Mic className="h-8 w-8" />}
            </span>
          </button>
          <button onClick={onOpenChat} aria-label="Abrir no chat" className="glass loop-border press flex h-12 w-12 items-center justify-center rounded-full justify-self-end">
            <MessageSquare className="h-5 w-5" />
          </button>
                </div>
      </div>

      {/* campo de texto (modo teclado) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[116px]">
        <div
          className={`absolute bottom-[max(env(safe-area-inset-bottom),16px)] left-1/2 flex w-full max-w-[640px] -translate-x-1/2 flex-col gap-2 transition-all duration-300 ${
            mode === 'text' ? 'pointer-events-auto opacity-100' : 'pointer-events-none translate-y-8 opacity-0'
          }`}
          style={{ transitionTimingFunction: 'var(--spring)', paddingInline: side }}
        >
          {(contextTitle || attachment) && (
            <div className="flex flex-wrap items-center gap-2">
              {contextTitle && (
                <span className={`flex max-w-full items-center gap-2 rounded-full py-1.5 pl-3.5 pr-1.5 text-caption ${GL}`}>
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
            <button
              onClick={() => {
                taRef.current?.blur();
                setMode('voice');
              }}
              aria-label="Voltar para falar"
              tabIndex={mode === 'text' ? 0 : -1}
              className="glass loop-border press flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            >
              <X className="h-5 w-5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            <div className="glass loop-border flex min-h-[52px] min-w-0 flex-1 items-center rounded-[22px] pl-4 pr-2">
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
                className="max-h-[120px] min-w-0 flex-1 resize-none border-0 bg-transparent py-3.5 text-body leading-snug text-ink placeholder:text-ink/40 focus:outline-none"
              />
            </div>
            <button
              onClick={send}
              disabled={!canSend}
              aria-label="Enviar"
              tabIndex={mode === 'text' ? 0 : -1}
              className="glass-ink press flex h-12 w-12 shrink-0 items-center justify-center rounded-full disabled:opacity-40 loop-border"
             
            >
              <ArrowUp className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
