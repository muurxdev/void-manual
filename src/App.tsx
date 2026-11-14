import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useVoidStore } from './data/store';
import { generateLocalAnswer } from './data/rag';
import { HomeScreen } from './components/HomeScreen';
import { Dock } from './components/Dock';
import { useFeedback } from './components/Feedback';
import { AuthFlow } from './components/Auth';
import { GlassDefs } from './components/Glass';
import type { VoiceState } from './data/types';
import { useTheme, detectLens } from './data/theme';
import { loadPrefs, speakText, type SpeakHandle } from './data/tts';
import { voiceSummary } from './data/voiceText';
import { transition, type NavKind } from './data/nav';
import { currentAccount, onAccountChange, signOut, type Account } from './data/auth';
import { askAI, askAIStream, AiError } from './data/ai';
import { usePlan } from './data/usePlan';
// cada tela pesada só é baixada quando a pessoa abre
import { VoiceScreen } from './components/VoiceScreen';
import { ChatScreen } from './components/ChatScreen';
import { SettingsPanel, ProfilePanel, HistorySheet } from './components/Sheets';
import { LibrarySheet } from './components/Library';
import { PlansPanel } from './components/PlansPanel';
import { toManual } from './data/library';
import { useLibrary } from './data/useLibrary';

type Screen = 'home' | 'voice' | 'chat';
type SheetName = 'library' | 'library-pick' | 'settings' | 'profile' | 'history' | 'plans' | null;

interface StreamState {
  timer: number;
  convId: string;
  msgId: string;
  text: string;
}

const PHASES = ['Lendo sua pergunta', 'Consultando os manuais', 'Diagnosticando'];
const DEFAULT_TOPICS = ['Torque e folgas', 'Códigos de falha', 'Elétrica', 'Motor'];

export function App() {
  const {
    conversations,
    setActiveId,
    activeConversation,
    createConversation,
    deleteConversation,
    restoreConversation,
    updateConversation,
    addMessage,
    updateStreamingMessage,
    finalizeStreamingMessage,
    patchMessage,
    allManuals,
    profile,
    setProfile,
  } = useVoidStore();
  const theme = useTheme();
  const lib = useLibrary();
  useEffect(() => detectLens(), []);

  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // a sessão vem do servidor; até saber, não mostra a tela de entrada para não piscar
  useEffect(() => {
    let live = true;
    currentAccount()
      .then((acc) => {
        if (live) {
          setAccount(acc);
          setAuthReady(true);
        }
      })
      .catch(() => live && setAuthReady(true));
    const off = onAccountChange((acc) => live && setAccount(acc));
    return () => {
      live = false;
      off();
    };
  }, []);
  const planCtl = usePlan(account?.email);
  const [screen, setScreen] = useState<Screen>(() => {
    try {
      return sessionStorage.getItem('void_web_screen') === 'chat' && localStorage.getItem('void_web_active_id') ? 'chat' : 'home';
    } catch {
      return 'home';
    }
  });
  const [sheet, setSheet] = useState<SheetName>(null);
  const fb = useFeedback();
  const [isStreaming, setIsStreaming] = useState(false);
  const [contextItem, setContextItem] = useState<{ id: string; title: string } | null>(null);

  // ---- conversa por voz ----
  const [voiceStatus, setVoiceStatus] = useState<VoiceState>('idle');
  const [voicePhase, setVoicePhase] = useState('');
  const [voiceUser, setVoiceUser] = useState('');
  const [voiceReply, setVoiceReply] = useState('');
  const [voiceCites, setVoiceCites] = useState<{ title: string; line?: number }[]>([]);
  const [voicePulse, setVoicePulse] = useState(0);
  const [voiceError, setVoiceError] = useState('');

  const recRef = useRef<any>(null);
  const streamRef = useRef<StreamState | null>(null);
  const speechRef = useRef<SpeakHandle | null>(null);
  const timers = useRef<number[]>([]);

  // tudo que a Biblioteca entende entra na busca das respostas
  const ragManuals = useMemo(() => [...allManuals, ...lib.items.map(toManual)], [allManuals, lib.items]);
  const topics = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of lib.items) for (const t of r.topics) if (!/^(Geral|Sem texto|Imagem sem)/.test(t)) count.set(t, (count.get(t) || 0) + 1);
    const mine = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    return [...mine, ...DEFAULT_TOPICS.filter((d) => !mine.includes(d))].slice(0, 8);
  }, [lib.items]);

  const latest = useRef({ activeConversation, ragManuals, voiceStatus, contextItem, screen });
  latest.current = { activeConversation, ragManuals, voiceStatus, contextItem, screen };

  /* ---------- navegação em pilha (voltar sempre volta à tela anterior) ---------- */
  const stack = useRef<Screen[]>([]);
  const depth = useRef(0);
  const sheetPushed = useRef(false);
  const skipPop = useRef(0);

  // atualizar a página no chat volta para o chat, e o voltar leva à Home
  useEffect(() => {
    try {
      sessionStorage.setItem('void_web_screen', screen === 'chat' ? 'chat' : 'home');
    } catch {
      /* sem storage */
    }
  }, [screen]);
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (screen === 'chat') {
      stack.current.push('home');
      depth.current = 1;
      window.history.pushState({ v: 1 }, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = (to: Screen, kind: NavKind = 'forward') => {
    stack.current.push(latest.current.screen);
    depth.current += 1;
    window.history.pushState({ v: 1 }, '');
    transition(kind, () => setScreen(to));
  };
  const goBack = () => {
    if (sheetPushed.current) return closeSheet();
    if (depth.current > 0) window.history.back(); // o popstate faz a volta animada
  };
  const openSheet = (name: Exclude<SheetName, null>) => {
    setSheet(name);
    if (!sheetPushed.current) {
      window.history.pushState({ v: 1 }, '');
      sheetPushed.current = true;
    }
  };
  function closeSheet(keepHistory = false) {
    setSheet(null);
    if (sheetPushed.current) {
      sheetPushed.current = false;
      if (!keepHistory) {
        skipPop.current += 1;
        window.history.back();
      }
    }
  }

  useEffect(() => {
    const onPop = () => {
      if (skipPop.current > 0) {
        skipPop.current -= 1;
        return;
      }
      if (sheetPushed.current) {
        sheetPushed.current = false;
        setSheet(null);
        return;
      }
      if (depth.current > 0) {
        depth.current -= 1;
        const prev = stack.current.pop() ?? 'home';
        transition('back', () => {
          if (prev === 'home') setActiveId(null);
          setScreen(prev);
        });
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setActiveId]);

  useEffect(() => {
    return () => {
      if (streamRef.current) clearInterval(streamRef.current.timer);
      recRef.current?.abort?.();
      speechRef.current?.cancel();
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const toldUploads = useRef(new Set<string>());
  useEffect(() => {
    for (const u of lib.uploads) {
      if (toldUploads.current.has(u.id)) continue;
      if (u.stage === 'pronto') {
        toldUploads.current.add(u.id);
        fb.toast(`Arquivo adicionado: ${u.name}`);
      } else if (u.stage === 'erro') {
        toldUploads.current.add(u.id);
        fb.toast(u.error ? `Não consegui ler ${u.name}: ${u.error}` : `Não consegui ler ${u.name}`, 'error');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib.uploads]);

  // contexto da pergunta: máquina escolhida e, se houver, o arquivo da biblioteca
  const askToken = useRef(0);
  const questionWithContext = (content: string) => {
    const prev = [...(latest.current.activeConversation?.messages ?? [])].reverse().find((x) => x.role === 'user')?.content;
    return prev && content.trim().split(/\s+/).length <= 7 ? prev + ' ' + content : content;
  };
  const historyPairs = () => {
    const msgs = latest.current.activeConversation?.messages ?? [];
    const pairs: { q: string; a: string }[] = [];
    for (let i = 0; i < msgs.length - 1; i++) if (msgs[i].role === 'user' && msgs[i + 1].role === 'assistant' && msgs[i + 1].content) pairs.push({ q: msgs[i].content, a: voiceSummary(msgs[i + 1].content).slice(0, 500) });
    return pairs.slice(-3);
  };
  /** IA no servidor; se não der (sem internet, sem chave, erro), usa o motor do aparelho. Sem saldo no plano, devolve null. */
  const abortRef = useRef<AbortController | null>(null);
  const resolveAnswer = async (content: string, mode: 'chat' | 'voice', onText?: (t: string) => void) => {
    try {
      const { ragManuals: all, contextItem: ctx } = latest.current;
      const pool = ctx ? all.filter((x) => x.id === ctx.id) : all;
      const base = { question: questionWithContext(content), manuals: pool.length ? pool : all, history: historyPairs() };
      if (mode === 'chat' && onText) {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        const s = await askAIStream(base, onText, ac.signal);
        planCtl.applyServer(s.plan, s.left);
        return { text: s.text, citations: s.citations, analysis: 'Resposta gerada com IA a partir dos manuais.', streamed: true };
      }
      const r = await askAI({ ...base, mode });
      planCtl.applyServer(r.plan, r.left);
      // na voz, tira marcas de fonte como [1] para não serem lidas em voz alta
      const text = mode === 'voice' ? r.text.replace(/\s*\[\d+\]/g, '') : r.text;
      return { text, citations: r.citations, analysis: 'Resposta gerada com IA a partir dos manuais.', streamed: false };
    } catch (e) {
      if (e instanceof AiError && e.code === 'limite') {
        fb.toast('Você usou todas as perguntas de hoje no plano ' + planCtl.plan.name, 'info');
        openSheet('plans');
        return null;
      }
      if (!guardQuestion()) return null;
      if ((e as Error)?.name === 'AbortError') return null;
      const loc = answer(content);
      return { ...loc, streamed: false };
    }
  };

  const answer = (content: string) => {
    const { ragManuals: all, contextItem: ctx } = latest.current;
    const pool = ctx ? all.filter((x) => x.id === ctx.id) : all;
    return generateLocalAnswer(questionWithContext(content), pool.length ? pool : all);
  };

  /* ---------- chat de texto ---------- */
  /** Cada pergunta (texto ou voz) conta no plano. Sem saldo, abre a tela de planos. */
  const guardQuestion = (): boolean => {
    if (!planCtl.question.ok) {
      const max = planCtl.plan.limits.questionsPerDay;
      fb.toast('Você usou as ' + max + ' perguntas de hoje no plano ' + planCtl.plan.name, 'info');
      openSheet('plans');
      return false;
    }
    planCtl.countQuestion();
    return true;
  };

  const handleSend = async (content: string, options: { deepThink: boolean; attachment?: string; forceNew?: boolean }) => {
    if (isStreaming) return;
    const conv = options.forceNew ? createConversation(content) : (activeConversation ?? createConversation(content));
    const convId = conv.id;
    const now = Date.now();

    addMessage(convId, { id: 'msg-u-' + now.toString(36), role: 'user', content, timestamp: now, attachment: options.attachment });
    if (screen !== 'chat') navigate('chat', 'forward');

    const msgId = 'msg-a-' + now.toString(36);
    addMessage(convId, { id: msgId, role: 'assistant', content: '', timestamp: now + 10, isStreaming: true });
    setIsStreaming(true);
    const token = ++askToken.current;
    const state: StreamState = { timer: 0, convId, msgId, text: '' };
    streamRef.current = state; // dá para tocar em "Parar" já enquanto a IA pensa

    // o texto aparece à medida que chega, no máximo uma vez por quadro
    let latestText = '';
    let queued = 0;
    const flush = () => {
      queued = 0;
      if (token === askToken.current) {
        state.text = latestText;
        updateStreamingMessage(convId, msgId, latestText);
      }
    };
    const res = await resolveAnswer(content, 'chat', (t) => {
      latestText = t;
      if (!queued) queued = requestAnimationFrame(flush);
    });
    if (queued) cancelAnimationFrame(queued);
    if (token !== askToken.current) return; // a pessoa parou
    if (!res) {
      finalizeStreamingMessage(convId, msgId, 'Não consegui responder agora. Veja o seu plano ou tente de novo em instantes.');
      streamRef.current = null;
      setIsStreaming(false);
      return;
    }
    patchMessage(convId, msgId, { citations: res.citations, analysis: res.analysis });
    if (res.streamed) {
      finalizeStreamingMessage(convId, msgId, res.text);
      streamRef.current = null;
      setIsStreaming(false);
      return;
    }
    let full = res.text;
    if (options.deepThink) full += `\n\n> **Análise profunda:** cruze com histórico de falhas térmicas e resistência do chicote principal.`;

    const words = full.split(' ');
    let i = 0;
    state.timer = window.setInterval(() => {
      if (i < words.length) {
        state.text += (i > 0 ? ' ' : '') + words[i++];
        updateStreamingMessage(convId, msgId, state.text);
      } else {
        clearInterval(state.timer);
        finalizeStreamingMessage(convId, msgId, full);
        streamRef.current = null;
        setIsStreaming(false);
      }
    }, 28);
  };

  const handleStop = () => {
    askToken.current++;
    abortRef.current?.abort();
    const s = streamRef.current;
    if (!s) return;
    clearInterval(s.timer);
    finalizeStreamingMessage(s.convId, s.msgId, s.text || '…');
    streamRef.current = null;
    setIsStreaming(false);
  };

  /* ---------- conversa por voz: ouvir → pensar → falar, na própria tela ---------- */
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const stopVoiceOutput = () => {
    speechRef.current?.cancel();
    speechRef.current = null;
    clearTimers();
  };

  const askVoid = async (content: string) => {
    stopVoiceOutput();
    setVoiceError('');
    setVoiceUser(content);
    setVoiceReply('');
    setVoiceCites([]);
    setVoiceStatus('thinking');
    setVoicePhase(PHASES[0]);
    PHASES.forEach((p, i) => timers.current.push(window.setTimeout(() => setVoicePhase(p), i * 700)));

    const conv = latest.current.activeConversation ?? createConversation(content);
    const now = Date.now();
    addMessage(conv.id, { id: 'msg-u-' + now.toString(36), role: 'user', content, timestamp: now });
    const token = ++askToken.current;
    const started = Date.now();

    const res = await resolveAnswer(content, 'voice');
    if (token !== askToken.current) return;
    if (!res) {
      clearTimers();
      setVoiceStatus('idle');
      return;
    }
    addMessage(conv.id, { id: 'msg-a-' + now.toString(36), role: 'assistant', content: res.text, timestamp: now + 10, citations: res.citations, analysis: res.analysis });
    setVoiceCites(res.citations.map((c) => ({ title: c.title, line: c.line })));

    const summary = voiceSummary(res.text);
    timers.current.push(
      window.setTimeout(() => {
        setVoiceStatus('speaking');
        setVoiceReply('');
        speechRef.current = speakText(summary, {
          prefs: loadPrefs(),
          onProgress: (idx) => {
            setVoiceReply(summary.slice(0, idx));
            setVoicePulse((p) => p + 1);
          },
          onEnd: () => {
            setVoiceReply(summary);
            setVoiceStatus('idle');
            speechRef.current = null;
          },
        });
      }, Math.max(0, PHASES.length * 700 + 100 - (Date.now() - started)))
    );
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    stopVoiceOutput();
    setVoiceUser('');
    setVoiceReply('');
    setVoiceCites([]);
    setVoiceError('');
    if (!SR) {
      setVoiceError('Este navegador não reconhece voz. Toque no teclado para escrever.');
      return;
    }
    try {
      recRef.current?.abort?.();
      const r = new SR();
      let heard = false;
      let words = 0;
      r.lang = 'pt-BR';
      r.continuous = false;
      r.interimResults = true;
      r.onstart = () => setVoiceStatus('listening');
      r.onend = () => {
        if (latest.current.voiceStatus === 'listening' && !heard) setVoiceStatus('idle');
      };
      r.onerror = (e: any) => {
        setVoiceStatus('idle');
        setVoiceError(
          e.error === 'not-allowed' || e.error === 'service-not-allowed'
            ? 'Permita o microfone para falar com o Void.'
            : e.error === 'no-speech'
              ? 'Não ouvi nada. Toque no microfone e tente de novo.'
              : 'Não consegui ouvir agora. Toque no microfone para tentar de novo.'
        );
      };
      r.onresult = (e: any) => {
        let t = '';
        for (let k = 0; k < e.results.length; k++) t += e.results[k][0].transcript;
        setVoiceUser(t);
        const n = t.trim().split(/\s+/).length;
        if (n !== words) {
          words = n;
          setVoicePulse((p) => p + 1); // cada palavra ouvida é uma batida
        }
        if (e.results[e.results.length - 1].isFinal && t.trim()) {
          heard = true;
          askVoid(t.trim());
        }
      };
      recRef.current = r;
      r.start();
    } catch {
      setVoiceStatus('idle');
      setVoiceError('Não consegui iniciar o microfone.');
    }
  };

  const onMic = () => {
    const s = latest.current.voiceStatus;
    if (s === 'listening') recRef.current?.stop?.();
    else if (s === 'speaking') {
      stopVoiceOutput();
      setVoiceStatus('idle');
    } else if (s === 'idle') startListening();
  };

  const resetVoice = () => {
    askToken.current++;
    recRef.current?.abort?.();
    stopVoiceOutput();
    setVoiceStatus('idle');
    setVoiceUser('');
    setVoiceReply('');
    setVoiceCites([]);
    setVoiceError('');
  };

  /* ---------- ações das telas ---------- */
  const openVoice = () => {
    if (sheet) closeSheet(true);
    resetVoice(); // o microfone só liga quando a pessoa toca nele
    navigate('voice', 'forward');
  };
  const newChat = () => {
    if (sheet) closeSheet(true);
    setActiveId(null);
    navigate('chat', 'forward');
  };
  const openChat = (id: string) => {
    setActiveId(id);
    if (sheet) closeSheet(true);
    navigate('chat', 'forward');
  };
  const askFromHome = (q: string) => handleSend(q, { deepThink: false, forceNew: true });
  const voiceToChat = () => {
    recRef.current?.abort?.();
    stopVoiceOutput();
    setVoiceStatus('idle');
    navigate('chat', 'forward');
  };

  const logout = () => {
    resetVoice();
    void signOut();
    closeSheet(true);
    stack.current = [];
    depth.current = 0;
    transition('back', () => {
      setAccount(null);
      setActiveId(null);
      setScreen('home');
    });
  };

  // o que já foi dito nesta conversa, para a tela de voz mostrar o contexto
  const voiceHistory = (() => {
    const msgs = activeConversation?.messages ?? [];
    const pairs: { q: string; a: string }[] = [];
    for (let i = 0; i < msgs.length - 1; i++) if (msgs[i].role === 'user' && msgs[i + 1].role === 'assistant') pairs.push({ q: msgs[i].content, a: (() => { const s = voiceSummary(msgs[i + 1].content); return s.length > 110 ? s.slice(0, 110).trimEnd() + '…' : s; })() });
    return (voiceUser ? pairs.slice(0, -1) : pairs).slice(-3);
  })();

  const askLogout = async () => {
    const ok = await fb.confirm({ title: 'Sair da conta?', message: 'Você vai precisar entrar de novo para usar o Void.', confirmLabel: 'Sair', danger: true });
    if (!ok) return;
    logout();
    fb.toast('Você saiu da conta', 'info');
  };

  const onAuth = (a: Account) => {
    fb.toast(`Bem-vindo, ${a.name.split(' ')[0]}`);
    setProfile({ ...profile, mechanic: a.name });
    transition('rise', () => setAccount(a));
  };

  const dark = theme.resolved === 'dark';

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper font-sans text-ink">
      <GlassDefs />
      <div className="relative h-full">
        <Suspense fallback={null}>
        {authReady && !account && <AuthFlow dark={dark} onDone={onAuth} />}

        {/* com uma tela cheia aberta, o fundo fica inerte: sem foco, sem leitor de tela */}
        <div className="h-full" {...(sheet ? ({ inert: true } as object) : {})} aria-hidden={sheet ? true : undefined}>
        {account && screen === 'home' && (
          <div className="screen-fade h-full">
          <HomeScreen
            profile={profile}
            conversations={conversations}
            libraryCount={allManuals.length + lib.items.length}
            topics={topics}
            planName={planCtl.plan.name}
            planNote={planCtl.question.left === null ? 'sem limite' : planCtl.question.left + ' restantes'}
            onPlans={() => openSheet('plans')}
            onOpenChat={openChat}
            onNewChat={newChat}
            onVoice={openVoice}
            onLibrary={() => {
              openSheet('library');
            }}
            onProfile={() => openSheet('profile')}
            onSignOut={askLogout}
            onViewAll={() => openSheet('history')}
            onAsk={askFromHome}
          />
          </div>
        )}

        {account && screen === 'voice' && (
          <div data-screen className="screen-in h-full">
          <VoiceScreen
            status={voiceStatus}
            phase={voicePhase}
            userText={voiceUser}
            replyText={voiceReply}
            error={voiceError}
            pulse={voicePulse}
            citations={voiceCites}
            history={voiceHistory}
            dark={dark}
            canOpenChat={!!activeConversation && activeConversation.messages.length > 0}
            onBack={() => {
              resetVoice();
              goBack();
            }}
            onMic={onMic}
            onSendText={askVoid}
            contextTitle={contextItem?.title}
            onClearContext={() => setContextItem(null)}
            onPickLibrary={() => openSheet('library-pick')}
            onSendWithAttachment={(t, a) => handleSend(t, { deepThink: false, attachment: a })}
            onOpenChat={voiceToChat}
          />
          </div>
        )}

        {account && screen === 'chat' && (
          <div data-screen className="screen-in h-full">
          <ChatScreen
            title={activeConversation && activeConversation.messages.length > 0 ? activeConversation.title : 'Chat técnico'}
            messages={activeConversation?.messages ?? []}
            isStreaming={isStreaming}
            dark={dark}
            contextTitle={contextItem?.title}
            onClearContext={() => setContextItem(null)}
            onPickLibrary={() => openSheet('library-pick')}
            onBack={goBack}
            onSend={handleSend}
            onStop={handleStop}
            onVoice={openVoice}
            onDelete={
              activeConversation
                ? () => {
                    const gone = deleteConversation(activeConversation.id);
                    goBack();
                    return gone ? () => restoreConversation(gone) : undefined;
                  }
                : undefined
            }
          />
          </div>
        )}

        </div>

        {account && (sheet === 'library' || sheet === 'library-pick') && (
          <LibrarySheet
            items={lib.items}
            included={allManuals}
            uploads={lib.uploads}
            onFiles={(files) => {
              const list = Array.from(files);
              const room = planCtl.canAddFiles(lib.items.length, list.length);
              const big = list.find((f) => f.size > planCtl.plan.limits.fileMb * 1048576);
              if (big) {
                fb.toast('O plano ' + planCtl.plan.name + ' aceita arquivos de até ' + planCtl.plan.limits.fileMb + ' MB', 'info');
                openSheet('plans');
                return [];
              }
              if (!room.ok) {
                fb.toast('O plano ' + planCtl.plan.name + ' guarda até ' + room.max + ' arquivos seus', 'info');
                openSheet('plans');
                return [];
              }
              return lib.addFiles(list);
            }}
            onRemove={lib.remove}
            onPick={
              sheet === 'library-pick'
                ? (r) => {
                    setContextItem(r);
                    fb.toast(`Usando ${r.title}`, 'info');
                    closeSheet();
                  }
                : undefined
            }
            onClose={() => closeSheet()}
          />
        )}
        {account && sheet === 'plans' && (
          <PlansPanel plan={planCtl.plan} plans={planCtl.plans} usage={planCtl.usage} filesCount={lib.items.length} waitlist={planCtl.waitlist} onJoin={planCtl.joinWaitlist} onClose={() => closeSheet()} email={account.email} name={profile.mechanic} />
        )}
        {account && sheet === 'settings' && (
          <SettingsPanel theme={theme.choice} onTheme={theme.set} profile={profile} onSave={setProfile} onClose={() => closeSheet()} />
        )}
        {account && sheet === 'profile' && (
          <ProfilePanel email={account.email} profile={profile} onSave={setProfile} onClose={() => closeSheet()} onSignOut={askLogout} planName={planCtl.plan.name} onPlans={() => openSheet('plans')} stats={{ conversations: conversations.length, files: lib.items.length, questions: planCtl.usage.questions }} />
        )}
        {account && screen === 'home' && (
          <Dock
            onNewChat={newChat}
            onVoice={openVoice}
            onLibrary={() => openSheet('library')}
            onAddFile={() => {
              openSheet('library');
              window.setTimeout(() => window.dispatchEvent(new Event('void-pick-file')), 450);
            }}
            onHistory={() => openSheet('history')}
            onPlans={() => openSheet('plans')}
            onProfile={() => openSheet('profile')}
            onSettings={() => openSheet('settings')}
          />
        )}
        {account && sheet === 'history' && (
          <HistorySheet conversations={conversations} onClose={() => closeSheet()} onOpen={openChat} onDelete={deleteConversation} onRestore={restoreConversation} onUpdate={updateConversation} />
        )}
        </Suspense>
      </div>
    </div>
  );
}

export default App;
