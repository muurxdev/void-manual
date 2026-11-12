import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, LogOut, MessageSquare, Mic, User } from 'lucide-react';
import { useDockScroll } from './Dock';
import { PullRefresh } from './PullRefresh';
import type { Conversation, WorkshopProfile } from '../data/types';
import { Dropdown, type MenuItem } from './ui';
import { Greeting } from './Greeting';
import { useSmoothWheel } from '../data/useSmoothWheel';

interface HomeScreenProps {
  profile: WorkshopProfile;
  conversations: Conversation[];
  libraryCount: number;
  topics: string[];
  /** plano atual e o que resta dele hoje (ex.: Grátis · 7 restantes) */
  planName: string;
  planNote: string;
  onPlans: () => void;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onVoice: () => void;
  onLibrary: () => void;
  onProfile: () => void;
  onSignOut: () => void;
  onViewAll: () => void;
  onAsk: (q: string) => void;
}


const QUESTIONS: Record<string, [string, string]> = {
  'Torque e folgas': ['Quais são os torques de aperto principais?', 'Como ajustar a folga de válvulas?'],
  'Códigos de falha': ['O que significam os códigos de falha?', 'Como ler a piscada da luz de injeção?'],
  Elétrica: ['Como testar o chicote e os relés?', 'Quais fusíveis protegem a ignição?'],
  Motor: ['Quais são as especificações do motor?', 'Como diagnosticar perda de compressão?'],
  Injeção: ['Como testar a bomba de combustível?', 'Como calibrar o sensor TPS?'],
  Freios: ['Qual a espessura mínima das pastilhas?', 'Como sangrar o fluido de freio?'],
};
const questionsFor = (t: string): [string, string] =>
  QUESTIONS[t] ?? [`O que os manuais dizem sobre ${t.toLowerCase()}?`, `Principais cuidados com ${t.toLowerCase()}`];

const stripMd = (t: string) =>
  t.replace(/```[\s\S]*?```/g, '').replace(/[#>*`_-]/g, '').replace(/\s+/g, ' ').trim();

const RecentList: React.FC<{ recent: Conversation[]; onOpenChat: (id: string) => void; onViewAll: () => void; className?: string }> = ({
  recent,
  onOpenChat,
  onViewAll,
  className = '',
}) => (
  <section className={className} aria-label="Conversas recentes">
    <div className="flex items-baseline justify-between">
      <h2 className="text-[16px] font-medium">Conversas recentes</h2>
      {recent.length > 0 && (
        <button onClick={onViewAll} className="-my-3 min-h-11 px-2 text-[13px] text-sub">
          Ver todas
        </button>
      )}
    </div>
    <div className="card anim-fade-up mt-3 divide-y divide-hair overflow-hidden rounded-[22px]">
      {recent.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-mute">Nenhuma conversa ainda.</p>
      ) : (
        recent.map((c) => {
          const answer = c.messages.find((m) => m.role === 'assistant');
          return (
            <button key={c.id} onClick={() => onOpenChat(c.id)} className="press flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-fill">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium leading-snug text-ink">{c.title}</span>
                <span className="mt-1 block truncate text-[12.5px] leading-snug text-sub">{answer ? stripMd(answer.content) || '…' : 'Sem resposta'}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-mute" />
            </button>
          );
        })
      )}
    </div>
  </section>
);

export const HomeScreen: React.FC<HomeScreenProps> = React.memo(function HomeScreen({
  profile,
  conversations,
  libraryCount,
  topics,
  planName,
  planNote,
  onPlans,
  onOpenChat,
  onNewChat,
  onVoice,
  onLibrary,
  onProfile,
  onSignOut,
  onViewAll,
  onAsk,
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  useSmoothWheel(scroller);
  useDockScroll(scroller);
  useEffect(() => {
    const up = () => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.addEventListener('void-scroll-top', up);
    return () => window.removeEventListener('void-scroll-top', up);
  }, []);
  const [menu, setMenu] = useState<'profile' | null>(null);
  const [heroOk, setHeroOk] = useState(true);
  const [topic, setTopic] = useState('');
  const recent = conversations.filter((c) => c.messages.length > 0).slice(0, 3);
  const chips = topics.length ? topics : ['Torque e folgas', 'Códigos de falha', 'Elétrica', 'Motor'];
  const active = topic || chips[0];
  const first = profile.mechanic.trim().split(' ')[0] || 'você';

  // ao rolar, o hero sobe devagar, escurece e vai sendo coberto pelo conteúdo
  useEffect(() => {
    const el = scroller.current;
    const hero = heroRef.current;
    if (!el || !hero) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      hero.style.setProperty('--p', Math.max(0, Math.min(1, el.scrollTop / 260)).toFixed(3));
      hero.style.setProperty('--y', `${el.scrollTop}`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const profileItems: MenuItem[] = [
    { key: 'p', label: 'Perfil', hint: profile.mechanic, icon: <User className="h-4 w-4" />, onSelect: onProfile },
    { key: 'x', label: 'Sair', icon: <LogOut className="h-4 w-4" />, danger: true, onSelect: onSignOut },
  ];


  return (
    <div className="relative flex h-full flex-col bg-paper">
      <div ref={heroRef} className="hero-mesh pointer-events-none absolute inset-x-0 top-0 h-[clamp(250px,36vh,400px)] overflow-hidden" style={{ maskImage: 'linear-gradient(to bottom, #000 30%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 30%, transparent 100%)', opacity: 'calc(1 - var(--p, 0))' }} aria-hidden="true">
        {heroOk && (
          <img
            src={`${import.meta.env.BASE_URL}hero-home.webp`}
            alt=""
            width={900}
            height={1200}
            fetchPriority="high"
            decoding="async"
            onError={() => setHeroOk(false)}
            className="hero-img h-full w-full object-cover object-[50%_34%]"
          />
        )}
        <div className="hero-dim absolute inset-0 bg-black" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-paper" />
      </div>

      <PullRefresh target={scroller} />
      <div ref={scroller} className="scroll-smooth-area safe-top relative flex-1 pb-28">
        <div className="mx-auto w-full max-w-[1040px] px-[clamp(16px,5.6vw,40px)]">
          <header className="relative z-20 flex items-center justify-between">
            <div className="relative">
              <button
                onClick={() => setMenu((m) => (m === 'profile' ? null : 'profile'))}
                aria-label="Menu do perfil"
                aria-haspopup="menu"
                aria-expanded={menu === 'profile'}
                className="glass press flex h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-4"
              >
                <span className="glass-ink flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-[14px] font-semibold">
                  {profile.photo ? <img src={profile.photo} alt="" className="h-full w-full object-cover" /> : first.slice(0, 1).toUpperCase()}
                </span>
                <span className="whitespace-nowrap text-[13px] font-medium">Olá, {first}</span>
              </button>
              <Dropdown open={menu === 'profile'} onClose={() => setMenu(null)} items={profileItems} placement="bottom-start" />
            </div>

            <button onClick={onPlans} aria-label={'Planos. Seu plano: ' + planName + ', ' + planNote} className="glass press flex h-11 items-center gap-2 rounded-full px-3.5 text-[13px]">
              <span className="font-medium">{planName}</span>
              <span className="max-w-[26vw] truncate text-mute md:max-w-[220px]">{planNote}</span>
            </button>
          </header>

          <div className="mt-[clamp(110px,19vh,190px)]">
            <Greeting name={profile.mechanic} line2="Como posso ajudar hoje?" />
          </div>

          {recent[0] && (
            <button onClick={() => onOpenChat(recent[0].id)} className="card anim-fade-up press mt-6 flex w-full items-center gap-3 p-3.5 text-left">
              <span className="glass-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <MessageSquare className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-mute">Continuar de onde parou</span>
                <span className="block truncate text-[15px] font-medium">{recent[0].title}</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-mute" />
            </button>
          )}

          <div className={`${recent[0] ? 'mt-2' : 'mt-6'} grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3`}>
            <div style={{ ['--i' as string]: 1 }} className="card anim-fade-up row-span-2 flex h-[212px] flex-col justify-between p-4 md:h-auto md:min-h-[250px] md:p-5">
              <span className="text-[clamp(22px,2.2vw+10px,30px)] font-medium leading-[1.18]">
                Conversar
                <br />
                com o Void
                <span className="mt-1 block text-[12.5px] font-normal leading-snug text-sub">Pergunte sobre qualquer máquina</span>
              </span>
              <button onClick={onNewChat} className="glass-ink press h-11 w-full rounded-full text-[14px] font-medium">
                Começar
              </button>
            </div>

            <button onClick={onVoice} style={{ ['--i' as string]: 2 }} className="card anim-fade-up press flex h-[100px] flex-col justify-between p-4 text-left md:h-auto md:min-h-[118px] md:p-5">
              <span className="flex w-full items-start justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fill">
                  <Mic className="h-4 w-4" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-mute" />
              </span>
              <span>
                <span className="block text-[15px] font-medium leading-tight">Voz</span>
                <span className="block text-[12px] leading-tight text-sub">Fale e ouça a resposta</span>
              </span>
            </button>

            <button onClick={onLibrary} style={{ ['--i' as string]: 3 }} className="card anim-fade-up press flex h-[100px] flex-col justify-between p-4 text-left md:h-auto md:min-h-[118px] md:p-5">
              <span className="flex w-full items-start justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fill">
                  <BookOpen className="h-4 w-4" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-mute" />
              </span>
              <span>
                <span className="block text-[15px] font-medium leading-tight">Biblioteca</span>
                <span className="block text-[12px] leading-tight text-sub">{libraryCount} itens seus e do Void</span>
              </span>
            </button>

            <RecentList recent={recent} onOpenChat={onOpenChat} onViewAll={onViewAll} className="hidden md:col-start-3 md:row-span-2 md:row-start-1 md:block" />
          </div>

          <RecentList recent={recent} onOpenChat={onOpenChat} onViewAll={onViewAll} className="mt-8 md:hidden" />
          <section className="mt-8" aria-label="Tópicos">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[16px] font-medium">Tópicos</h2>
              <button onClick={onLibrary} className="-my-3 min-h-11 px-2 text-[13px] text-sub">
                Ver todos
              </button>
            </div>
            <div className="-mx-[clamp(16px,5.6vw,40px)] mt-3 flex gap-2 overflow-x-auto px-[clamp(16px,5.6vw,40px)] pb-1">
              {chips.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className={`press shrink-0 rounded-full min-h-11 px-4 text-[13px] transition-colors ${active === t ? 'bg-ink text-paper' : 'border border-hair bg-paper text-ink/75'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div key={active} className="mt-3 grid grid-cols-2 gap-2 md:gap-3">
              {questionsFor(active).map((q, i) => (
                <div key={q} style={{ ['--i' as string]: i }} className="card anim-fade-up flex min-h-[148px] flex-col justify-between p-4">
                  <div>
                    <p className="text-[14.5px] font-medium leading-snug">{q}</p>
                    <p className="mt-1.5 text-[12px] leading-snug text-sub">Nos seus manuais e arquivos</p>
                  </div>
                  <button onClick={() => onAsk(q)} className="press mt-3 h-11 rounded-full border border-hair text-[13px] font-medium">
                    Descobrir
                  </button>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>

    </div>
  );
});
