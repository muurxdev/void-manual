import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

/** Mantém o elemento montado durante a animação de saída. */
export function usePresence(open: boolean, exitMs = 160) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);
  return { mounted: open || mounted, closing: !open && mounted };
}

export interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  selected?: boolean;
  hint?: string;
  onSelect: () => void;
}

interface DropdownProps {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  /** posição relativa ao gatilho */
  placement: 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';
  title?: string;
}

const PLACEMENT: Record<DropdownProps['placement'], string> = {
  'bottom-end': 'right-0 top-[calc(100%+10px)] origin-top-right',
  'bottom-start': 'left-0 top-[calc(100%+10px)] origin-top-left',
  'top-end': 'right-0 bottom-[calc(100%+14px)] origin-bottom-right',
  'top-start': 'left-0 bottom-[calc(100%+14px)] origin-bottom-left',
};

/** Menu em Liquid Glass com entrada em spring e itens em cascata. */
export const Dropdown: React.FC<DropdownProps> = ({ open, onClose, items, placement, title }) => {
  const { mounted, closing } = usePresence(open, 220);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        aria-label={title}
        className={`menu-surface absolute z-40 w-[232px] rounded-[22px] p-1.5 ${PLACEMENT[placement]}`}
        style={{
          opacity: shown && !closing ? 1 : 0,
          transform: shown && !closing ? 'none' : 'translate3d(0, 14px, 0) scale(.97)',
          transition: shown && !closing ? 'opacity 200ms var(--ease-out), transform 280ms var(--ease-out)' : 'opacity 160ms var(--ease-in), transform 200ms var(--ease-in)',
        }}
      >
        {title && <p className="px-3 pb-1 pt-2 text-[12px] uppercase tracking-wider text-mute">{title}</p>}
        {items.map((it, i) => (
          <button
            key={it.key}
            role="menuitem"
            style={{ ['--i' as string]: i }}
            onClick={() => {
              onClose();
              it.onSelect();
            }}
            className={`menu-item press flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[14px] transition-colors active:bg-ink/5 ${
              it.danger ? 'text-red-600' : 'text-ink'
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/5">{it.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{it.label}</span>
              {it.hint && <span className="block truncate text-[12px] text-mute">{it.hint}</span>}
            </span>
            {it.selected && <Check className="h-4 w-4 shrink-0" />}
          </button>
        ))}
      </div>
    </>
  );
};
