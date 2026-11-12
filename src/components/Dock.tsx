import React, { useEffect, useRef, useState, type RefObject } from 'react';
import { BookOpen, House, MessageSquarePlus, Mic, Plus, Settings, UploadCloud } from 'lucide-react';
import { Dropdown, type MenuItem } from './ui';

/** Quem rola avisa o dock: some ao descer, volta ao subir. */
export function useDockScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = el.scrollTop;
    let hidden = false;
    const send = (v: boolean) => window.dispatchEvent(new CustomEvent('void-dock', { detail: v }));
    const on = () => {
      const top = el.scrollTop;
      const dy = top - last;
      if (Math.abs(dy) > 6) {
        const hide = dy > 0 && top > 80;
        if (hide !== hidden) {
          hidden = hide;
          send(hide);
        }
        last = top;
      }
      if (top < 40 && hidden) {
        hidden = false;
        send(false);
      }
    };
    el.addEventListener('scroll', on, { passive: true });
    return () => {
      el.removeEventListener('scroll', on);
      send(false);
    };
  }, [ref]);
}

const dockBtn = 'press relative flex h-11 w-[52px] items-center justify-center rounded-full transition-colors';

interface DockProps {
  active: 'home' | 'settings' | '';
  onHome: () => void;
  onNewChat: () => void;
  onVoice: () => void;
  onSettings: () => void;
  onLibrary: () => void;
  onAddFile: () => void;
  /** item das ações rápidas que está aberto agora: o botão vira o ícone dele */
  quickActive: 'chat' | 'voz' | 'arq' | 'lib' | '';
}

/** Menu inferior flutuante: Início, [Void], Voz, Configurações. Fica por cima das telas. */
export const Dock: React.FC<DockProps> = ({ active, onHome, onNewChat, onVoice, onSettings, onLibrary, onAddFile, quickActive }) => {
  const [hidden, setHidden] = useState(false);
  const [quick, setQuick] = useState(false);
  const [kb, setKb] = useState(false);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    let base = Math.max(window.innerHeight, window.visualViewport?.height ?? 0);
    const check = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      if (Math.max(window.innerHeight, h) > base) base = Math.max(window.innerHeight, h);
      const open = h < base - 140;
      setKb((was) => {
        if (was && !open) setHidden(false); // teclado fechou: o menu volta
        return open;
      });
    };
    const reset = () => {
      base = window.innerHeight;
      check();
    };
    window.visualViewport?.addEventListener('resize', check);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', reset);
    return () => {
      window.visualViewport?.removeEventListener('resize', check);
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', reset);
    };
  }, []);
  useEffect(() => {
    const on = (e: Event) => setHidden(!!(e as CustomEvent).detail);
    window.addEventListener('void-dock', on);
    return () => window.removeEventListener('void-dock', on);
  }, []);
  const ICON = {
    chat: <MessageSquarePlus className="h-[24px] w-[24px]" />,
    voz: <Mic className="h-[24px] w-[24px]" />,
    arq: <UploadCloud className="h-[24px] w-[24px]" />,
    lib: <BookOpen className="h-[24px] w-[24px]" />,
  } as const;
  const items: MenuItem[] = [
    { key: 'chat', label: 'Nova conversa', hint: 'Escreva uma pergunta', icon: <MessageSquarePlus className="h-4 w-4" />, selected: quickActive === 'chat', onSelect: onNewChat },
    { key: 'voz', label: 'Perguntar falando', hint: 'Fale e ouça a resposta', icon: <Mic className="h-4 w-4" />, selected: quickActive === 'voz', onSelect: onVoice },
    { key: 'arq', label: 'Adicionar arquivo', hint: 'PDF, Word, Excel, imagem', icon: <UploadCloud className="h-4 w-4" />, selected: quickActive === 'arq', onSelect: onAddFile },
    { key: 'lib', label: 'Abrir biblioteca', hint: 'Seus manuais e arquivos', icon: <BookOpen className="h-4 w-4" />, selected: quickActive === 'lib', onSelect: onLibrary },
  ];
  const tone = (k: string) => (active === k ? 'text-ink' : 'text-ink/45');
  return (
    <nav
      ref={nav}
      style={{ transform: hidden || kb ? 'translate3d(0, 160%, 0)' : 'none', transition: 'transform 600ms var(--spring-soft)' }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+14px)]"
      aria-label="Principal"
    >
      <div className="pointer-events-auto flex items-center gap-3">
        <div className="glass flex h-[56px] items-center rounded-full px-2">
          <button onClick={onHome} aria-label="Início" aria-current={active === 'home' ? 'page' : undefined} className={`${dockBtn} ${tone('home')}`}>
            <House className="h-[22px] w-[22px]" strokeWidth={active === 'home' ? 2.4 : 1.8} />
          </button>
          <button onClick={onVoice} aria-label="Voz" className={`${dockBtn} text-ink/45`}>
            <Mic className="h-[22px] w-[22px]" strokeWidth={1.8} />
          </button>
          <button onClick={onSettings} aria-label="Configurações" aria-current={active === 'settings' ? 'page' : undefined} className={`${dockBtn} ${tone('settings')}`}>
            <Settings className="h-[22px] w-[22px]" strokeWidth={active === 'settings' ? 2.4 : 1.8} />
          </button>
        </div>

        {/* ações rápidas, separado do menu */}
        <div className="relative">
          <button
            onClick={() => setQuick((q) => !q)}
            aria-label="Ações rápidas"
            aria-haspopup="menu"
            aria-expanded={quick}
            className="glass-ink press flex h-[56px] w-[56px] items-center justify-center rounded-full"
          >
            <span key={quickActive || 'plus'} className="anim-pop flex items-center justify-center">
              {quickActive ? (
                ICON[quickActive]
              ) : (
                <Plus className="h-[24px] w-[24px] stroke-[2.4] transition-transform duration-500" style={{ transform: quick ? 'rotate(135deg)' : 'none', transitionTimingFunction: 'var(--spring)' }} />
              )}
            </span>
          </button>
          <Dropdown open={quick} onClose={() => setQuick(false)} items={items} placement="top-end" title="Ações rápidas" />
        </div>
      </div>
    </nav>
  );
};
