import React from 'react';
import { ChevronRight } from 'lucide-react';

/** Grupo de linhas: título pequeno e um cartão com divisores (padrão de Perfil, Configurações e Planos). */
export const Group: React.FC<{ title?: string; footer?: string; children: React.ReactNode; className?: string }> = ({ title, footer, children, className = '' }) => (
  <section className={'mt-6 first:mt-0 ' + className}>
    {title && <h2 className="mb-2 px-1 text-caption font-medium uppercase tracking-[0.12em] text-mute">{title}</h2>}
    <div className="card divide-y divide-hair overflow-hidden">{children}</div>
    {footer && <p className="mt-2 px-1 text-caption text-mute">{footer}</p>}
  </section>
);

interface RowProps {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  value?: React.ReactNode;
  /** elemento à direita (ex.: Toggle); sem ele, mostra a seta quando há onClick */
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}

/** Uma linha: ícone em chip, texto, valor e seta ou controle. */
export const Row: React.FC<RowProps> = ({ icon, label, hint, value, right, onClick, danger }) => {
  const body = (
    <>
      {icon && <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' + (danger ? 'bg-red-500/10 text-red-500' : 'bg-fill')}>{icon}</span>}
      <span className="min-w-0 flex-1 text-left">
        <span className={'block truncate text-body font-medium ' + (danger ? 'text-red-500' : '')}>{label}</span>
        {hint && <span className="block truncate text-caption text-sub">{hint}</span>}
      </span>
      {value && <span className="shrink-0 text-small text-sub">{value}</span>}
      {right ?? (onClick && <ChevronRight className="h-4 w-4 shrink-0 text-mute" />)}
    </>
  );
  const cls = 'flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2.5';
  return onClick ? (
    <button type="button" onClick={onClick} className={cls + ' press'}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};

/** Interruptor liga/desliga. */
export const Toggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={'press relative h-8 w-[52px] shrink-0 rounded-full transition-colors ' + (on ? 'bg-ink' : 'bg-ink/15')}>
    <span className={'absolute top-1 h-6 w-6 rounded-full bg-paper shadow transition-transform ' + (on ? 'translate-x-[24px]' : 'translate-x-1')} />
  </button>
);

/** Escolha entre opções, em pílulas lado a lado. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string; icon?: React.ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-full bg-fill p-1" style={{ gridTemplateColumns: 'repeat(' + options.length + ', minmax(0, 1fr))' }}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={'press flex min-h-10 items-center justify-center gap-1.5 rounded-full text-small font-medium transition-colors ' + (value === o.id ? 'bg-ink text-paper' : 'text-ink/70')}>
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
