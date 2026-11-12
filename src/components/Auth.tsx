import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, KeyRound, Mail, User } from 'lucide-react';
import { sendCode, verifyCode, type Account } from '../data/auth';
import { transition } from '../data/nav';
import { DustField } from './DustField';
import { VoidParticles, type Stage } from './VoidParticles';

type View = 'welcome' | 'signin' | 'signup' | 'code';

interface AuthProps {
  dark: boolean;
  onDone: (a: Account) => void;
  initial?: View;
}

const Shell: React.FC<{ dark: boolean; children: React.ReactNode }> = ({ dark, children }) => (
  <div className="hero-mesh relative flex h-full min-h-[100dvh] flex-col overflow-hidden">
    <DustField dark={dark} intensity={0.8} className="pointer-events-none absolute inset-0 h-full w-full" />
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">{children}</div>
  </div>
);

const Field: React.FC<{
  icon: React.ReactNode;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  trailing?: React.ReactNode;
  invalid?: boolean;
}> = ({ icon, label, type = 'text', value, onChange, autoComplete, trailing, invalid }) => (
  <label className="block">
    <span className="mb-1.5 flex items-center gap-1.5 px-1 text-[12px] text-mute">
      {icon}
      {label}
    </span>
    <span className={`glass flex items-center overflow-hidden rounded-2xl pr-2 ${invalid ? 'ring-1 ring-red-500' : ''}`}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        required
        className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-[15px] text-ink placeholder:text-mute focus:outline-none"
      />
      {trailing}
    </span>
  </label>
);

const STAGES: Stage[] = ['idle', 'search', 'speak']; // a animação muda junto com cada mensagem
const SLIDES = [
  { t: 'Libere o conhecimento', t2: 'de qualquer máquina.', s: 'Seu manual vivo para moto, carro, trator e mais.' },
  { t: 'Pergunte, fale', t2: 'ou envie arquivos.', s: 'Texto, voz, PDF, planilha, foto e áudio: o Void lê e entende.' },
  { t: 'Respostas com fonte,', t2: 'direto na bancada.', s: 'Torque, folgas e códigos de falha, com o manual de onde veio.' },
];

/** Entrada: nuvem de pontos da marca, três mensagens que passam sozinhas e um único caminho principal. */
const Welcome: React.FC<{ dark: boolean; onStart: () => void; onSignin: () => void }> = ({ dark, onStart, onSignin }) => {
  const [i, setI] = useState(0);
  const [pulse, setPulse] = useState(0);
  const touch = useRef<number | null>(null);
  const hold = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (hold.current) return;
      setI((n) => (n + 1) % SLIDES.length);
      setPulse((p) => p + 1);
    }, 4800);
    return () => window.clearInterval(id);
  }, []);
  const go = (n: number) => {
    hold.current = true;
    setI((n + SLIDES.length) % SLIDES.length);
    setPulse((p) => p + 1);
    window.setTimeout(() => (hold.current = false), 8000);
  };

  return (
    <div
      className="safe-top safe-bottom relative mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-1 flex-col px-[clamp(20px,6vw,40px)]"
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
      }}
    >
      <div className="relative -mx-[clamp(20px,6vw,40px)] min-h-0 flex-1" style={{ minHeight: '44dvh' }}>
        <VoidParticles state="idle" stage={STAGES[i]} pulse={pulse} dark={dark} className="pointer-events-none absolute inset-0 h-full w-full" />
      </div>

      <div className="pb-2 text-center" aria-live="polite">
        <h1 key={i} className="anim-fade-up text-[clamp(30px,4vw+16px,42px)] font-medium leading-[1.1] tracking-[-0.02em]">
          {SLIDES[i].t}
          <br />
          <span className="text-sub">{SLIDES[i].t2}</span>
        </h1>
        <p key={'s' + i} className="anim-fade-up mx-auto mt-3 min-h-[44px] max-w-[330px] text-[15px] leading-relaxed text-sub" style={{ ['--i' as string]: 1 }}>
          {SLIDES[i].s}
        </p>
        <div className="mt-2 flex justify-center" role="tablist" aria-label="Mensagens">
          {SLIDES.map((_, n) => (
            <button key={n} role="tab" aria-selected={n === i} aria-label={`Mensagem ${n + 1}`} onClick={() => go(n)} className="flex h-11 w-8 items-center justify-center">
              <span className={`block h-1.5 rounded-full bg-ink transition-all duration-300 ${n === i ? 'w-6' : 'w-1.5 opacity-25'}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 pb-4 pt-1">
        <button onClick={onStart} className="glass-ink press h-[56px] rounded-full text-[16px] font-medium">
          Começar
        </button>
        <button onClick={onSignin} className="press min-h-12 rounded-full text-[15px] text-sub">
          Já tenho conta · <span className="font-medium text-ink underline underline-offset-4">Entrar</span>
        </button>
      </div>
    </div>
  );
};

export const AuthFlow: React.FC<AuthProps> = ({ dark, onDone, initial = 'welcome' }) => {
  const [view, setView] = useState<View>(initial);
  const [from, setFrom] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  // contagem para poder pedir outro código
  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(id);
  }, [wait]);

  const go = (v: View, kind: 'forward' | 'back') => {
    setError('');
    transition(kind, () => setView(v));
  };

  const askCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      await sendCode(email, from === 'signup' ? name : undefined);
      setCode('');
      setWait(60);
      if (view !== 'code') go('code', 'forward');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui enviar o código.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await verifyCode(email, code));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui entrar.');
    } finally {
      setBusy(false);
    }
  };

  if (view === 'welcome') {
    return (
      <Shell dark={dark}>
        <Welcome
          dark={dark}
          onStart={() => {
            setFrom('signup');
            go('signup', 'forward');
          }}
          onSignin={() => {
            setFrom('signin');
            go('signin', 'forward');
          }}
        />
      </Shell>
    );
  }

  const isCode = view === 'code';
  const signup = view === 'signup';
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  const ready = isCode ? code.replace(/\D/g, '').length === 6 : emailOk && (!signup || (!!name.trim() && terms));

  return (
    <Shell dark={dark}>
      <div className="safe-top safe-bottom mx-auto flex w-full max-w-[460px] flex-1 flex-col px-[clamp(20px,6vw,40px)] pb-16">
        <button onClick={() => go(isCode ? from : 'welcome', 'back')} aria-label="Voltar" className="icon-btn glass">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="anim-fade-up mt-8 text-[34px] font-medium tracking-[-0.02em]">{isCode ? 'Digite o código' : signup ? 'Criar conta' : 'Entrar'}</h1>
        <p className="anim-fade-up mt-1 text-[14px] text-sub" style={{ ['--i' as string]: 1 }}>
          {isCode ? 'Enviamos 6 números para ' + email.trim() + '. Vale por 10 minutos.' : signup ? 'Sem senha: você entra com um código no e-mail.' : 'Vamos mandar um código para o seu e-mail.'}
        </p>

        <form onSubmit={isCode ? confirm : askCode} className="mt-7 space-y-4">
          {!isCode && signup && <Field icon={<User className="h-3.5 w-3.5" />} label="Seu nome" value={name} onChange={setName} autoComplete="name" />}
          {!isCode && <Field icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />}
          {isCode && (
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 px-1 text-[12px] text-mute">
                <KeyRound className="h-3.5 w-3.5" /> Código
              </span>
              <span className="glass flex items-center overflow-hidden rounded-2xl px-2">
                <input
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  aria-label="Código de 6 números"
                  className="min-w-0 flex-1 bg-transparent px-3 py-4 text-center font-mono text-[28px] tracking-[0.5em] text-ink placeholder:text-mute focus:outline-none"
                />
              </span>
            </label>
          )}

          {!isCode && signup && (
            <label className="flex items-start gap-2.5 px-1 text-[13px] leading-snug text-sub">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-[22px] w-[22px] shrink-0 accent-[rgb(var(--ink))]" />
              Concordo com os termos de uso e a política de privacidade.
            </label>
          )}

          {error && (
            <p role="alert" className="anim-fade-in rounded-2xl bg-red-500/10 px-4 py-3 text-[13px] text-red-500">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy || !ready} className="glass-ink press h-[54px] w-full rounded-full text-[15px] font-medium disabled:opacity-50">
            {busy ? 'Aguarde…' : isCode ? 'Entrar' : 'Enviar código'}
          </button>

          {isCode && (
            <button type="button" onClick={() => askCode()} disabled={busy || wait > 0} className="press min-h-12 w-full rounded-full text-[14px] text-sub disabled:opacity-60">
              {wait > 0 ? 'Pedir outro código em ' + wait + ' s' : 'Não chegou? Pedir outro código'}
            </button>
          )}
        </form>

        {!isCode && (
          <p className="mt-auto pt-8 text-center text-[13px] text-sub">
            {signup ? 'Já tem conta? ' : 'Ainda não tem conta? '}
            <button
              onClick={() => {
                setFrom(signup ? 'signin' : 'signup');
                go(signup ? 'signin' : 'signup', 'forward');
              }}
              className="min-h-11 font-medium text-ink underline underline-offset-4"
            >
              {signup ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        )}
      </div>
    </Shell>
  );
};
