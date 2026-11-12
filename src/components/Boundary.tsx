import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { VoidMark } from './VoidMark';

/** Se algo quebrar, mostra uma tela amigável em vez de uma página em branco. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('Void: erro na tela', error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-paper px-8 text-center text-ink">
        <VoidMark size={56} />
        <h1 className="text-[22px] font-medium">Algo deu errado</h1>
        <p className="max-w-[320px] text-[14px] leading-relaxed text-sub">O Void encontrou um problema. Suas conversas e arquivos continuam guardados.</p>
        <button onClick={() => window.location.reload()} className="glass-ink press h-12 rounded-full px-8 text-[15px] font-medium">
          Recarregar
        </button>
      </div>
    );
  }
}

/** Aviso discreto quando o aparelho fica sem internet. */
export const OfflineBanner: React.FC = () => {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-0 z-[95] flex justify-center px-4 pt-[max(env(safe-area-inset-top),8px)]">
      <span className="glass-strong anim-fade-up flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium">
        <WifiOff className="h-4 w-4" /> Sem conexão. O Void usa o que está no aparelho.
      </span>
    </div>
  );
};
