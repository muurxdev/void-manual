import React, { useEffect, useRef, useState } from 'react';
import { VoidMark } from './VoidMark';
import { ArrowLeft, MoreHorizontal, Plus, Mic, ArrowUp, Square, Copy, Volume2, Check, Trash2, X, Image as ImageIcon, BookOpen, ThumbsUp, ThumbsDown, RotateCcw, Share2, ArrowDown } from 'lucide-react';
import type { Message } from '../data/types';
import { Dropdown, type MenuItem } from './ui';
import { DustField } from './DustField';
import { useSmoothWheel } from '../data/useSmoothWheel';
import { useDictation } from '../data/useDictation';
import { useFeedback } from './Feedback';
import { DictationWave } from './DictationWave';

interface ChatScreenProps {
  title: string;
  messages: Message[];
  isStreaming: boolean;
  dark: boolean;
  contextTitle?: string;
  onClearContext: () => void;
  onPickLibrary: () => void;
  onBack: () => void;
  onSend: (content: string, options: { deepThink: boolean; attachment?: string }) => void;
  onStop: () => void;
  onVoice: () => void;
  onDelete?: () => (() => void) | void;
}

const THINK = ['Lendo sua pergunta', 'Consultando os manuais', 'Montando a resposta'];

/** Enquanto a resposta não começa: o estado muda sozinho e o texto brilha, como nos assistentes de IA. */
const Thinking: React.FC = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => Math.min(n + 1, THINK.length - 1)), 1700);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p key={i} className="anim-fade-up flex items-center gap-2 py-0.5 text-body" role="status" aria-live="polite">
      <span className="shimmer-text font-medium">{THINK[i]}…</span>
    </p>
  );
};

const SUGGESTIONS: { q: string; sub: string }[] = [
  { q: 'Tabela de torque de cabeçote e biela da Honda CB 500F', sub: 'Torque e folgas' },
  { q: 'Tabela completa de códigos de falha PGM-FI e MIL Honda', sub: 'Códigos de falha' },
  { q: 'Diagnóstico de vela carbonizada e faísca fraca na Titan 160', sub: 'Motor e ignição' },
  { q: 'Ajuste de folga de válvulas da Lander 250 (frio)', sub: 'Manutenção' },
];

// Destaca valores de especificação (torque, folga, pressão...) para leitura rápida.
const SPEC_RE = /(\d+(?:[.,]\d+)?(?:\s?[-–]\s?\d+(?:[.,]\d+)?)?\s?(?:N\.?m|kgf\.?m|mm|bar|kPa|PSI|°C|V|Ω|ohms?))/gi;

export const ChatScreen: React.FC<ChatScreenProps> = ({
  title,
  messages,
  isStreaming,
  dark,
  contextTitle,
  onClearContext,
  onPickLibrary,
  onBack,
  onSend,
  onStop,

  onDelete,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState(false);
  const [plus, setPlus] = useState(false);
  const [votes, setVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [atEnd, setAtEnd] = useState(true);
  const dict = useDictation();
  const fb = useFeedback();

  const finishDictation = () => {
    const t = dict.stop();
    if (t) setInput((p) => (p ? p.trimEnd() + ' ' : '') + t);
    window.setTimeout(() => taRef.current?.focus(), 50);
  };
  const sendDictation = () => {
    const t = dict.stop();
    const full = ((input ? input.trimEnd() + ' ' : '') + t).trim();
    if (!full && !attachment) return;
    onSend(full || 'Analise esta imagem.', { deepThink: false, attachment: attachment || undefined });
    setInput('');
    setAttachment(null);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: isStreaming ? 'auto' : 'smooth' });
  }, [messages, isStreaming]);
  useSmoothWheel(scrollRef);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const on = () => setAtEnd(el.scrollHeight - el.scrollTop - el.clientHeight < 140);
    on();
    el.addEventListener('scroll', on, { passive: true });
    return () => el.removeEventListener('scroll', on);
  }, [messages.length]);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 110)}px`;
    }
  }, [input]);

  const canSend = (input.trim() !== '' || attachment !== null) && !isStreaming;

  const submit = () => {
    if (!canSend) return;
    onSend(input.trim() || 'Analise esta imagem.', { deepThink: false, attachment: attachment || undefined });
    setInput('');
    setAttachment(null);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setAttachment(r.result as string);
    r.readAsDataURL(f);
    e.target.value = '';
  };

  const copy = (id: string, text: string) => {
    try {
      navigator.clipboard?.writeText(text);
    } catch {
      /* contexto inseguro */
    }
    setCopiedId(id);
    fb.toast('Mensagem copiada');
    setTimeout(() => setCopiedId(null), 1800);
  };

  const vote = (id: string, v: 'up' | 'down') => {
    setVotes((p) => {
      const next = { ...p };
      if (next[id] === v) delete next[id];
      else next[id] = v;
      return next;
    });
    fb.toast(v === 'up' ? 'Obrigado pelo retorno' : 'Anotado, vou melhorar', 'info');
  };
  const share = async (text: string) => {
    const clean = text.replace(/^> .*$/gm, '').replace(/[#*]/g, '').replace(/```\w*/g, '').trim();
    try {
      if (navigator.share) await navigator.share({ title: 'Void', text: clean });
      else {
        await navigator.clipboard?.writeText(clean);
        fb.toast('Texto copiado para compartilhar');
      }
    } catch {
      /* cancelado */
    }
  };
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
  const FOLLOW = ['Explicar passo a passo', 'Quais ferramentas preciso?', 'Quais os riscos?'];

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[#*`>-]/g, ''));
    u.lang = 'pt-BR';
    window.speechSynthesis.speak(u);
  };

  const plusItems: MenuItem[] = [
    { key: 'lib', label: 'Da biblioteca', hint: 'Responder com um arquivo seu', icon: <BookOpen className="h-4 w-4" />, onSelect: onPickLibrary },
    { key: 'img', label: 'Foto ou imagem', hint: 'Anexar à mensagem', icon: <ImageIcon className="h-4 w-4" />, onSelect: () => fileRef.current?.click() },
  ];

  const inline = (text: string) =>
    text.split(/(\*\*.*?\*\*|`.*?`)/g).flatMap((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return [<strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>];
      if (part.startsWith('`') && part.endsWith('`')) return [<code key={i} className="rounded bg-paper px-1 py-0.5 font-mono text-caption">{part.slice(1, -1)}</code>];
      return part.split(SPEC_RE).map((seg, j) =>
        j % 2 === 1 ? (
          <span key={`${i}-${j}`} className="whitespace-nowrap rounded bg-paper px-1 py-0.5 font-mono text-caption font-medium">
            {seg}
          </span>
        ) : (
          seg
        )
      );
    });

  const body = (msg: Message) => {
    const out: React.ReactNode[] = [];
    let code = false;
    let buf: string[] = [];
    const allLines = msg.content.split('\n');
    const chkRe = /^-\s*\[([ x])\]\s*(.*)/i;
    const total = allLines.filter((l) => chkRe.test(l)).length;
    const doneN = allLines.reduce((n, l, i) => {
      const m = l.match(chkRe);
      return n + (m && (checked[`${msg.id}-${i}`] ?? m[1].toLowerCase() === 'x') ? 1 : 0);
    }, 0);
    let counted = false;
    let lastTextIdx = -1;
    allLines.forEach((l, i) => {
      if (l.trim() && !l.startsWith('```') && !l.startsWith('> ') && !l.startsWith('#') && !chkRe.test(l)) lastTextIdx = i;
    });
    allLines.forEach((line, i) => {
      if (line.startsWith('```')) {
        if (code) {
          out.push(
            <pre key={`c${i}`} className="my-2 whitespace-pre-wrap break-words rounded-xl bg-paper p-3 font-mono text-caption leading-relaxed">
              {buf.join('\n')}
            </pre>
          );
          buf = [];
        }
        code = !code;
        return;
      }
      if (code) return void buf.push(line);

      const chk = line.match(chkRe);
      if (chk) {
        if (!counted) {
          counted = true;
          out.push(
            <div key={`n${i}`} className="mb-1 mt-1 flex items-center gap-2" aria-live="polite">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink/10">
                <div className="h-full origin-left rounded-full bg-ink transition-transform duration-300" style={{ transform: `scaleX(${total ? doneN / total : 0})` }} />
              </div>
              <span className="font-mono text-caption text-sub">
                {doneN} de {total}
              </span>
            </div>
          );
        }
        const key = `${msg.id}-${i}`;
        const on = checked[key] ?? chk[1].toLowerCase() === 'x';
        out.push(
          <button key={key} onClick={() => setChecked((p) => ({ ...p, [key]: !on }))} className="flex min-h-11 w-full items-start gap-2.5 py-2 text-left">
            <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border ${on ? 'border-ink bg-ink text-paper' : 'border-ink/25 bg-paper'}`}>
              {on && <Check className="h-3 w-3 stroke-[3]" />}
            </span>
            <span className={`text-body leading-snug ${on ? 'text-mute line-through' : ''}`}>{inline(chk[2])}</span>
          </button>
        );
        return;
      }
      if (line.startsWith('### ')) return void out.push(<h3 key={i} className="mb-1 mt-3 text-body font-semibold">{inline(line.slice(4))}</h3>);
      if (line.startsWith('#### ')) return void out.push(<h4 key={i} className="mb-1 mt-3 text-caption font-semibold text-sub">{inline(line.slice(5))}</h4>);
      if (line.startsWith('> ')) return; // notas técnicas internas ficam ocultas
      if (line.trim()) {
        if (msg.isStreaming && i === lastTextIdx) {
          const ws = line.split(' ');
          const tail = ws.slice(-2);
          out.push(
            <p key={i} className="my-1 text-body leading-relaxed">
              {inline(ws.slice(0, -2).join(' ') + (ws.length > 2 ? ' ' : ''))}
              {tail.map((w, k) => (
                <span key={ws.length - 2 + k} className="anim-word-in">
                  {w}
                  {k < tail.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
          );
        } else out.push(<p key={i} className="my-1 text-body leading-relaxed">{inline(line)}</p>);
      }
    });
    return out;
  };

  const time = (t: number) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const side = 'max(20px, calc((100% - 760px) / 2))';

  return (
    <div className="relative h-full overflow-hidden bg-paper">
      <DustField dark={dark} intensity={0.9} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-[15] h-[110px]" style={{ background: 'linear-gradient(to bottom, rgb(var(--paper)) 38%, rgb(var(--paper) / 0))' }} />
      <header className="safe-top absolute inset-x-0 top-0 z-20 flex items-center justify-between pb-3" style={{ paddingInline: side }}>
        <button onClick={onBack} aria-label="Voltar" className="icon-btn glass">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="glass loop-border mx-3 min-w-0 max-w-[200px] flex-1 truncate rounded-full px-4 py-1.5 text-center text-body">{title}</h1>
        <div className="relative">
          <button onClick={() => setMenu((m) => !m)} aria-label="Mais opções" aria-haspopup="menu" aria-expanded={menu} className="icon-btn glass">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <Dropdown
            open={menu}
            onClose={() => setMenu(false)}
            placement="bottom-end"
            items={[
              {
                key: 'del',
                label: 'Apagar conversa',
                icon: <Trash2 className="h-4 w-4" />,
                danger: true,
                onSelect: async () => {
                  if (!onDelete || messages.length === 0) {
                    fb.toast('Ainda não há conversa para apagar', 'info');
                    return;
                  }
                  const ok = await fb.confirm({ title: 'Apagar esta conversa?', message: 'Todas as mensagens serão apagadas e Você terá alguns segundos para desfazer.', confirmLabel: 'Apagar', danger: true });
                  if (!ok) return;
                  const undo = onDelete();
                  fb.toast('Conversa apagada', 'info', {
                    action: typeof undo === 'function' ? { label: 'Desfazer', onClick: () => { undo(); fb.toast('Conversa de volta'); } } : undefined,
                  });
                },
              },
            ]}
          />
        </div>
      </header>


      <div ref={scrollRef} className="scroll-smooth-area relative z-10 h-full pb-[150px] pt-[84px]" style={{ paddingInline: side }}>
        {messages.length === 0 ? (
          <div className="anim-fade-up flex min-h-full flex-col justify-end">
            <p className="text-[clamp(24px,3vw+12px,34px)] font-medium leading-tight tracking-[-0.02em]">
              <span className="text-sub">Como posso</span>
              <br />
              ajudar hoje?
            </p>
            <p className="mt-2 text-small text-sub">Pergunte sobre qualquer máquina ou escolha um atalho.</p>
            <div className="mt-5 grid gap-2 md:grid-cols-2">
              {SUGGESTIONS.map((s, i) => (
                <button key={s.q} style={{ ['--i' as string]: i }} onClick={() => onSend(s.q, { deepThink: false })} className="card anim-fade-up press px-4 py-3 text-left">
                  <span className="block text-body leading-snug">{s.q}</span>
                  <span className="mt-1 block text-caption text-sub">{s.sub}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="my-2 flex justify-center">
              <span className="glass rounded-full px-4 py-1.5 text-caption text-sub">Hoje</span>
            </div>
            <div className="space-y-5">
              {messages.map((m) => {
                const user = m.role === 'user';
                const sources = [...new Set((m.citations ?? []).map((c) => c.title))].slice(0, 2);
                return (
                  <div key={m.id} className={`anim-fade-up flex gap-2.5 ${user ? 'justify-end' : 'justify-start'}`}>
                    {!user && (
                      <span className="glass-ink relative mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                        {m.isStreaming && <span className="think-halo absolute inset-0 rounded-full border border-ink/40" aria-hidden="true" />}
                        <span className={m.isStreaming ? 'think-mark' : 'inline-flex'}>
                          <VoidMark size={18} />
                        </span>
                      </span>
                    )}
                    <div className={`flex min-w-0 max-w-[86%] flex-col ${user ? 'items-end' : 'items-start'}`}>
                      <div className={`rounded-[22px] px-4 py-3 ${user ? 'rounded-br-md bg-bubble text-white' : 'rounded-tl-md bg-assistant text-ink'}`}>
                        {m.attachment && <img src={m.attachment} alt="Anexo" className="mb-2 max-h-48 rounded-xl object-cover" />}
                        {user ? (
                          <p className="whitespace-pre-wrap text-body leading-relaxed">{m.content}</p>
                        ) : (
                          m.isStreaming && !m.content.trim() ? (
                            <Thinking />
                          ) : (
                            <>
                              {body(m)}
                              {m.isStreaming && <span className="ml-0.5 inline-block h-4 w-[2px] animate-blink bg-ink align-middle" />}
                            </>
                          )
                        )}
                      </div>
                      {!user && !m.isStreaming && sources.length > 0 && <p className="mt-1.5 px-1 text-caption text-mute">Baseado em {sources.join(' e ')}</p>}
                      <div className="anim-fade-in mt-0 flex flex-wrap items-center px-1 text-caption text-mute">
                        <span className="mr-1">{time(m.timestamp)}</span>
                        {!user && !m.isStreaming && (
                          <>
                            <button onClick={() => copy(m.id, m.content)} aria-label="Copiar" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-ink/5">
                              {copiedId === m.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </button>
                            <button onClick={() => speak(m.content)} aria-label="Ouvir" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-ink/5">
                              <Volume2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => share(m.content)} aria-label="Compartilhar" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-ink/5">
                              <Share2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => vote(m.id, 'up')} aria-label="Gostei" aria-pressed={votes[m.id] === 'up'} className={`flex h-11 w-11 items-center justify-center rounded-full active:bg-ink/5 ${votes[m.id] === 'up' ? 'text-ink' : ''}`}>
                              <ThumbsUp className={`h-4 w-4 ${votes[m.id] === 'up' ? 'fill-current' : ''}`} />
                            </button>
                            <button onClick={() => vote(m.id, 'down')} aria-label="Não gostei" aria-pressed={votes[m.id] === 'down'} className={`flex h-11 w-11 items-center justify-center rounded-full active:bg-ink/5 ${votes[m.id] === 'down' ? 'text-ink' : ''}`}>
                              <ThumbsDown className={`h-4 w-4 ${votes[m.id] === 'down' ? 'fill-current' : ''}`} />
                            </button>
                            {m.id === lastAssistantId && lastUser && !isStreaming && (
                              <button onClick={() => onSend(lastUser.content, { deepThink: false })} aria-label="Perguntar de novo" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-ink/5">
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {!user && m.id === lastAssistantId && !isStreaming && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {FOLLOW.map((f) => (
                            <button key={f} onClick={() => onSend(f, { deepThink: false })} className="glass press min-h-11 rounded-full px-4 text-small loop-border">
                              {f}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {!atEnd && messages.length > 0 && (
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })}
          aria-label="Ir para o fim"
          className="glass press anim-pop absolute bottom-[110px] right-5 z-20 flex h-11 w-11 items-center justify-center rounded-full"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}

      <div className="safe-bottom absolute inset-x-0 bottom-0 z-20 pb-2" style={{ paddingInline: 'max(16px, calc((100% - 760px) / 2))' }}>
        {isStreaming && (
          <div className="mb-3 flex justify-center">
            <button onClick={onStop} className="press anim-pop glass-ink flex items-center gap-2 rounded-full px-4 py-2.5 text-small font-medium">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white">
                <Square className="h-3 w-3 fill-black text-black" />
              </span>
              Parar resposta
            </button>
          </div>
        )}
        {contextTitle && (
          <div className="anim-fade-up mb-2 flex">
            <span className="glass flex max-w-full items-center gap-2 rounded-full py-1.5 pl-3.5 pr-1.5 text-caption">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Usando {contextTitle}</span>
              <button onClick={onClearContext} aria-label="Remover contexto" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/10">
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
        {attachment && (
          <div className="relative mb-2 inline-block">
            <img src={attachment} alt="Prévia do anexo" className="h-16 w-16 rounded-xl border border-hair object-cover" />
            <button onClick={() => setAttachment(null)} aria-label="Remover anexo" className="absolute -right-2.5 -top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {dict.active ? (
          <div className="anim-fade-up flex items-end gap-2.5">
            <button onClick={dict.cancel} aria-label="Cancelar ditado" className="glass press flex h-12 w-12 shrink-0 items-center justify-center rounded-full loop-border">
              <X className="h-5 w-5" />
            </button>
            <div className="glass flex min-h-[52px] min-w-0 flex-1 flex-col justify-center rounded-[22px] px-4 py-2" aria-live="polite">
              <p className="max-h-[64px] overflow-hidden break-words text-body leading-snug text-ink" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {dict.text || <span className="text-mute">Pode falar…</span>}
              </p>
              <DictationWave level={dict.level} className="mt-1 h-6 w-full text-ink" />
            </div>
            <button onClick={finishDictation} aria-label="Parar e editar o texto" className="glass press flex h-12 w-12 shrink-0 items-center justify-center rounded-full loop-border">
              <Square className="h-[18px] w-[18px] fill-current" />
            </button>
            <button onClick={sendDictation} aria-label="Parar e enviar" className="glass-ink press flex h-12 w-12 shrink-0 items-center justify-center rounded-full loop-border">
              <ArrowUp className="h-5 w-5 stroke-[2.5]" />
            </button>
          </div>
        ) : (
        <div className="flex items-end gap-2.5">
          <div className="relative">
            <button
              onClick={() => setPlus((p) => !p)}
              aria-label="Adicionar"
              aria-haspopup="menu"
              aria-expanded={plus}
              className="glass press flex h-12 w-12 items-center justify-center rounded-full loop-border"
            >
              <Plus className={`h-5 w-5 transition-transform duration-300 ${plus ? 'rotate-45' : ''}`} />
            </button>
            <Dropdown open={plus} onClose={() => setPlus(false)} items={plusItems} placement="top-start" />
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <div className="glass flex min-h-[52px] min-w-0 flex-1 items-center rounded-[22px] pl-4 pr-2">
            <label htmlFor="msg" className="sr-only">
              Mensagem
            </label>
            <textarea
              id="msg"
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Digite uma mensagem…"
              className="max-h-[110px] min-w-0 flex-1 resize-none border-0 bg-transparent py-3.5 text-body leading-snug text-ink placeholder:text-mute focus:outline-none"
            />
          </div>
          {canSend ? (
            <button onClick={submit} aria-label="Enviar" className="glass-ink press flex h-12 w-12 shrink-0 items-center justify-center rounded-full loop-border">
              <ArrowUp className="h-5 w-5 stroke-[2.5]" />
            </button>
          ) : (
            <button onClick={dict.start} aria-label="Ditar" className="glass-ink press flex h-12 w-12 shrink-0 items-center justify-center rounded-full loop-border">
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
        )}
        {dict.error && <p className="mt-1.5 px-2 text-center text-caption text-sub">{dict.error}</p>}
      </div>
    </div>
  );
};
