import React, { useEffect, useState, type RefObject } from 'react';
import { BookOpen, History, MessageSquarePlus, Mic, Plus, Settings, Gem, UploadCloud, User } from 'lucide-react';
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

interface DockProps {
  onNewChat: () => void;
  onVoice: () => void;
  onLibrary: () => void;
  onAddFile: () => void;
  onHistory: () => void;
  onPlans: () => void;
  onProfile: () => void;
  onSettings: () => void;
}

/** Um único "+" no meio, embaixo. Abre a lista de tudo; só Voz e Planos viram tela, o resto abre como folha com X. */
export const Dock: React.FC<DockProps> = ({ onNewChat, onVoice, onLibrary, onAddFile, onHistory, onPlans, onProfile, onSettings }) => {
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [kb, setKb] = useState(false);
  useEffect(() => {
    let base = Math.max(window.innerHeight, window.visualViewport?.height ?? 0);
    const check = () => {
      const h = window.visualViewport?.height ?? window.innerHeight;
      if (Math.max(window.innerHeight, h) > base) base = Math.max(window.innerHeight, h);
      const isOpen = h < base - 140;
      setKb((was) => {
        if (was && !isOpen) setHidden(false);
        return isOpen;
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
  const ic = 'h-4 w-4';
  const items: MenuItem[] = [
    { key: 'chat', label: 'Nova conversa', hint: 'Escreva uma pergunta', icon: <MessageSquarePlus className={ic} />, onSelect: onNewChat },
    { key: 'voz', label: 'Void Voice', hint: 'Fale e ouça a resposta', icon: <Mic className={ic} />, onSelect: onVoice },
    { key: 'lib', label: 'Biblioteca', hint: 'Seus manuais e arquivos', icon: <BookOpen className={ic} />, onSelect: onLibrary },
    { key: 'arq', label: 'Adicionar arquivo', hint: 'PDF, Word, Excel, imagem', icon: <UploadCloud className={ic} />, onSelect: onAddFile },
    { key: 'his', label: 'Conversas', hint: 'Seu histórico', icon: <History className={ic} />, onSelect: onHistory },
    { key: 'pla', label: 'Planos', hint: 'Limites e assinatura', icon: <Gem className={ic} />, onSelect: onPlans },
    { key: 'per', label: 'Perfil', hint: 'Conta e preferências', icon: <User className={ic} />, onSelect: onProfile },
    { key: 'cfg', label: 'Configurações', hint: 'Tema, voz e unidades', icon: <Settings className={ic} />, onSelect: onSettings },
  ];
  return (
    <nav
      style={{ transform: hidden || kb ? 'translate3d(0, 160%, 0)' : 'none', transition: 'transform 600ms var(--spring-soft)' }}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+18px)]"
      aria-label="Principal"
    >
      <div className="pointer-events-auto relative">
        <button
          onClick={() => setOpen((q) => !q)}
          aria-label="Menu"
          aria-haspopup="menu"
          aria-expanded={open}
          className="glass-ink loop-border press flex h-[60px] w-[60px] items-center justify-center rounded-full"
        >
          <Plus className="h-[26px] w-[26px] stroke-[2.4] transition-transform duration-500" style={{ transform: open ? 'rotate(135deg)' : 'none', transitionTimingFunction: 'var(--spring)' }} />
        </button>
        <div className="absolute left-1/2 top-0 h-0 w-[232px] -translate-x-1/2">
          <Dropdown open={open} onClose={() => setOpen(false)} items={items} placement="top-start" title="Menu" />
        </div>
      </div>
    </nav>
  );
};
