import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
type ToastKind = 'success' | 'error' | 'info';
export interface ToastOptions {
  /** Botão no aviso, ex.: Desfazer. */
  action?: { label: string; onClick: () => void };
  /** Quanto tempo fica na tela (ms). */
  duration?: number;
}
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
  leaving: boolean;
  action?: ToastOptions['action'];
}

interface Api {
  /** Pergunta antes de agir. Resolve true se a pessoa confirmou. */
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  /** Aviso rápido com o resultado de uma ação. */
  toast: (text: string, kind?: ToastKind, opts?: ToastOptions) => void;
}

const Ctx = createContext<Api | null>(null);

export function useFeedback(): Api {
  const c = useContext(Ctx);
  if (!c) throw new Error('useFeedback fora do FeedbackProvider');
  return c;
}

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<(ConfirmOptions & { leaving?: boolean }) | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const finish = useCallback((v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setDialog((d) => (d ? { ...d, leaving: true } : d));
    window.setTimeout(() => setDialog(null), 240);
  }, []);

  const confirm = useCallback((o: ConfirmOptions) => {
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setDialog(o);
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 400);
  }, []);

  const toast = useCallback(
    (text: string, kind: ToastKind = 'success', opts?: ToastOptions) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, text, kind, leaving: false, action: opts?.action }]);
      try {
        navigator.vibrate?.(kind === 'error' ? [20, 40, 20] : 12);
      } catch {
        /* sem vibração */
      }
      window.setTimeout(() => dismiss(id), opts?.duration ?? (opts?.action ? 6000 : 2600));
    },
    [dismiss]
  );

  const boxRef = useRef<HTMLDivElement>(null);
  const hasDialog = !!dialog;
  useEffect(() => {
    if (!hasDialog) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return finish(false);
      if (e.key !== 'Tab') return;
      const els = boxRef.current?.querySelectorAll<HTMLElement>('button');
      if (!els || !els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [hasDialog, finish]);

  const api = useMemo(() => ({ confirm, toast }), [confirm, toast]);

  return (
    <Ctx.Provider value={api}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center px-4 pb-[max(env(safe-area-inset-bottom),20px)]" role="alertdialog" aria-modal="true" aria-label={dialog.title}>
          <div onClick={() => finish(false)} className={`absolute inset-0 bg-black/45 ${dialog.leaving ? 'anim-scrim-out' : 'anim-scrim'}`} />
          <div ref={boxRef} className={`glass-strong relative w-full max-w-[420px] rounded-[30px] p-5 text-center ${dialog.leaving ? 'anim-sheet-out' : 'anim-sheet-in'}`}>
            <span className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${dialog.danger ? 'bg-red-500/15 text-red-500' : 'bg-ink/10 text-ink'}`}>
              {dialog.danger ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
            </span>
            <h2 className="text-title font-medium tracking-tight">{dialog.title}</h2>
            {dialog.message && <p className="mt-1.5 text-body leading-snug text-sub">{dialog.message}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button onClick={() => finish(false)} className="glass press h-12 rounded-full text-body font-medium loop-border">
                {dialog.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                onClick={() => finish(true)}
                autoFocus
                className={`press h-12 rounded-full text-body font-medium ${dialog.danger ? 'bg-red-500 text-white' : 'glass-ink'}`}
              >
                {dialog.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col-reverse items-center gap-2 px-4 pb-[calc(max(env(safe-area-inset-bottom),12px)+92px)]" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="glass-strong pointer-events-auto flex max-w-[360px] items-center gap-2.5 rounded-full py-2 pl-2.5 pr-4 text-small font-medium"
            style={{
              animation: t.leaving ? 'toastOut 380ms var(--ease-out) both' : 'toastIn 620ms var(--spring-soft) both',
            }}
            role="status"
            onClick={() => !t.action && dismiss(t.id)}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${t.kind === 'error' ? 'bg-red-500 text-white' : t.kind === 'info' ? 'bg-ink/15 text-ink' : 'bg-ink text-paper'}`}>
              {t.kind === 'error' ? <X className="h-3.5 w-3.5" /> : t.kind === 'info' ? <Info className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5 stroke-[3]" />}
            </span>
            <span className="min-w-0">{t.text}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="press -my-1 -mr-2 ml-1 min-h-10 shrink-0 rounded-full px-3.5 text-small font-semibold underline underline-offset-2"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
};
