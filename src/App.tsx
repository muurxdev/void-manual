import { useState, useEffect, useRef, useMemo } from 'react';
import { useVoidStore } from './data/store';
import { generateLocalAnswer } from './data/rag';
import { HomeScreen } from './components/HomeScreen';
import { VoiceScreen } from './components/VoiceScreen';
import { ChatScreen } from './components/ChatScreen';
import { SettingsPanel, ProfilePanel, HistorySheet } from './components/Sheets';
import { LibrarySheet } from './components/Library';
import { Dock } from './components/Dock';
import { useFeedback } from './components/Feedback';
import { AuthFlow } from './components/Auth';
import { GlassDefs } from './components/Glass';
import type { VoiceState } from './components/Particles';
import { useTheme, detectLens } from './data/theme';
import { loadPrefs, speakText, type SpeakHandle } from './data/tts';
import { voiceSummary } from './data/voiceText';
import { transition, type NavKind } from './data/nav';
import { getSession, signOut, type Account } from './data/auth';
import { toManual } from './data/library';
import { useLibrary } from './data/useLibrary';

type Screen = 'home' | 'voice' | 'chat';
type SheetName = 'library' | 'library-pick' | 'settings' | 'profile' | 'history' | null;

interface StreamState {
  timer: number;
  convId: string;
  msgId: string;
  text: string;
}

const PHASES = ['Lendo sua pergunta', 'Consultando os manuais', 'Diagnosticando'];
const MACHINE_KEY = 'void_web_machine';
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
    allManuals,
    profile,
    setProfile,
  } = useVoidStore();
  const theme = useTheme();
  const lib = useLibrary();
  useEffect(() => detectLens(), []);

  const [account, setAccount] = useState<Account | null>(() => getSession());
  const [screen, setScreen] = useState<Screen>(() => {
    try {
      return sessionStorage.getItem('void_web_screen') === 'chat' && localStorage.getItem('void_web_active_id') ? 'chat' : 'home';
    } catch {
      return 'home';
    }
  });
  const [sheet, setSheet] = useState<SheetName>(null);
  const [quickKey, setQuickKey] = useState<'lib' | 'arq'>('lib');
  const fb = useFeedback();
  const [isStreaming, setIsStreaming] = useState(false);
  const [machine, setMachine] = useState(() => {
    try {
      return localStorage.getItem(MACHINE_KEY) || '';
    } catch {
      return '';
    }
  });
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

  const latest = useRef({ activeConversation, ragManuals, voiceStatus, machine, contextItem, screen });
  latest.current = { activeConversation, ragManuals, voiceStatus, machine, contextItem, screen };

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

  const setMachineSaved = (m: string) => {
    setMachine(m);
    fb.toast(m ? `Máquina: ${m}` : 'Todas as máquinas', 'info');
    try {
      localStorage.setItem(MACHINE_KEY, m);
    } catch {
      /* sem storage */
    }
  };

  // contexto da pergunta: máquina escolhida e, se houver, o arquivo da biblioteca
  const answer = (content: string) => {
    const { ragManuals: all, machine: m, contextItem: ctx } = latest.current;
    const pool = ctx ? all.filter((x) => x.id === ctx.id) : all;
    return generateLocalAnswer(m ? `${m} ${content}` : content, pool.length ? pool : all);
  };

  /* ---------- chat de texto ---------- */
  const handleSend = (content: string, options: { deepThink: boolean; attachment?: string; forceNew?: boolean }) => {
    if (isStreaming) return;
    const conv = options.forceNew ? createConversation(content) : (activeConversation ?? createConversation(content));
    const convId = conv.id;
    const now = Date.now();

    addMessage(convId, { id: 'msg-u-' + now.toString(36), role: 'user', content, timestamp: now, attachment: options.attachment });
    if (screen !== 'chat') navigate('chat', 'forward');

    const { text: base, citations, analysis } = answer(content);
    let full = base;
    if (options.deepThink) full += `\n\n> **Análise profunda:** cruze com histórico de falhas térmicas e resistência do chicote principal.`;

    const msgId = 'msg-a-' + now.toString(36);
    addMessage(convId, { id: msgId, role: 'assistant', content: '', timestamp: now + 10, citations, analysis, isStreaming: true });
    setIsStreaming(true);

    const words = full.split(' ');
    let i = 0;
    const state: StreamState = { timer: 0, convId, msgId, text: '' };
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
    streamRef.current = state;
  };

  const handleStop = () => {
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

  const askVoid = (content: string) => {
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
    const { text: base, citations, analysis } = answer(content);
    addMessage(conv.id, { id: 'msg-u-' + now.toString(36), role: 'user', content, timestamp: now });
    addMessage(conv.id, { id: 'msg-a-' + now.toString(36), role: 'assistant', content: base, timestamp: now + 10, citations, analysis });
    setVoiceCites(citations.map((c) => ({ title: c.title, line: c.line })));

    const summary = voiceSummary(base);
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
      }, PHASES.length * 700 + 100)
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
    signOut();
    closeSheet(true);
    stack.current = [];
    depth.current = 0;
    transition('back', () => {
      setAccount(null);
      setActiveId(null);
      setScreen('home');
    });
  };

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
        {!account && <AuthFlow dark={dark} onDone={onAuth} />}

        {/* com uma tela cheia aberta, o fundo fica inerte: sem foco, sem leitor de tela */}
        <div className="h-full" {...(sheet ? ({ inert: true } as object) : {})} aria-hidden={sheet ? true : undefined}>
        {account && screen === 'home' && (
          <HomeScreen
            profile={profile}
            dark={dark}
            conversations={conversations}
            libraryCount={allManuals.length + lib.items.length}
            topics={topics}
            machine={machine}
            onMachine={setMachineSaved}
            onOpenChat={openChat}
            onNewChat={newChat}
            onVoice={openVoice}
            onLibrary={() => {
              setQuickKey('lib');
              openSheet('library');
            }}
            onProfile={() => openSheet('profile')}
            onSignOut={askLogout}
            onViewAll={() => openSheet('history')}
            onAsk={askFromHome}
          />
        )}

        {account && screen === 'voice' && (
          <VoiceScreen
            status={voiceStatus}
            phase={voicePhase}
            userText={voiceUser}
            replyText={voiceReply}
            error={voiceError}
            pulse={voicePulse}
            citations={voiceCites}
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
        )}

        {account && screen === 'chat' && (
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
        )}

        </div>

        {account && (sheet === 'library' || sheet === 'library-pick') && (
          <LibrarySheet
            items={lib.items}
            included={allManuals}
            uploads={lib.uploads}
            onFiles={lib.addFiles}
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
        {account && sheet === 'settings' && (
          <SettingsPanel theme={theme.choice} onTheme={theme.set} profile={profile} onSave={setProfile} onClose={() => closeSheet()} />
        )}
        {account && sheet === 'profile' && (
          <ProfilePanel email={account.email} profile={profile} onSave={setProfile} onClose={() => closeSheet()} onSignOut={askLogout} />
        )}
        {account && screen === 'home' && (
          <Dock
            active={sheet === 'settings' ? 'settings' : sheet ? '' : 'home'}
            onHome={() => window.dispatchEvent(new Event(sheet ? 'void-close-panel' : 'void-scroll-top'))}
            onNewChat={newChat}
            onVoice={openVoice}
            onSettings={() => (sheet === 'settings' ? undefined : openSheet('settings'))}
            quickActive={sheet === 'library' ? quickKey : ''}
            onLibrary={() => {
              setQuickKey('lib');
              if (sheet !== 'library') openSheet('library');
            }}
            onAddFile={() => {
              setQuickKey('arq');
              if (sheet !== 'library') openSheet('library');
              window.setTimeout(() => window.dispatchEvent(new Event('void-pick-file')), 450);
            }}
          />
        )}
        {account && sheet === 'history' && (
          <HistorySheet conversations={conversations} onClose={() => closeSheet()} onOpen={openChat} onDelete={deleteConversation} onRestore={restoreConversation} onUpdate={updateConversation} />
        )}
      </div>
    </div>
  );
}

export default App;
