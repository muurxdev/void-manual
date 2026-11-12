import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { signIn, signUp, resetPassword, passwordStrength, type Account } from '../data/auth';
import { transition } from '../data/nav';
import { DustField } from './DustField';
import { VoidParticles, type Stage } from './VoidParticles';

type View = 'welcome' | 'signin' | 'signup' | 'reset';

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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (v: View, kind: 'forward' | 'back') => {
    setError('');
    transition(kind, () => setView(v));
  };

  const submitIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await signIn(email, pw, remember));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  };

  const submitUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (pw !== pw2) return setError('As senhas não conferem.');
    if (!terms) return setError('Aceite os termos para continuar.');
    setBusy(true);
    setError('');
    try {
      onDone(await signUp(name, email, pw));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.');
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.');
    if (pw !== pw2) return setError('As senhas não conferem.');
    setBusy(true);
    setError('');
    try {
      onDone(await resetPassword(email, pw));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir.');
    } finally {
      setBusy(false);
    }
  };

  const ready = view === 'signin' ? !!email.trim() && !!pw : view === 'reset' ? !!email.trim() && pw.length >= 6 && pw === pw2 : !!name.trim() && !!email.trim() && pw.length >= 6 && pw === pw2 && terms;
  const strength = passwordStrength(pw);
  const meter =
    pw && view !== 'signin' ? (
      <div className="px-1" aria-live="polite">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${strength >= n ? (strength <= 1 ? 'bg-ink/35' : strength === 2 ? 'bg-ink/60' : 'bg-ink') : 'bg-ink/10'}`} />
          ))}
        </div>
        <p className="mt-1 text-[12px] text-mute">{['', 'Senha fraca', 'Pode melhorar', 'Boa senha', 'Senha forte'][strength]}</p>
      </div>
    ) : null;

  const eye = (
    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="flex h-11 w-11 items-center justify-center rounded-full text-mute active:bg-ink/5">
      {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
    </button>
  );

  if (view === 'welcome') {
    return (
      <Shell dark={dark}>
        <Welcome dark={dark} onStart={() => go('signup', 'forward')} onSignin={() => go('signin', 'forward')} />
      </Shell>
    );
  }

  const signin = view === 'signin';
  const reset = view === 'reset';
  return (
    <Shell dark={dark}>
      <div className="safe-top safe-bottom mx-auto flex w-full max-w-[460px] flex-1 flex-col pb-16 px-[clamp(20px,6vw,40px)]">
        <button onClick={() => go('welcome', 'back')} aria-label="Voltar" className="icon-btn glass">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="anim-fade-up mt-8 text-[34px] font-medium tracking-[-0.02em]">{reset ? 'Nova senha' : signin ? 'Entrar' : 'Criar conta'}</h1>
        <p className="anim-fade-up mt-1 text-[14px] text-sub" style={{ ['--i' as string]: 1 }}>
          {reset ? 'As contas ficam só neste aparelho, então dá para redefinir aqui.' : signin ? 'Que bom te ver de novo.' : 'Leva menos de um minuto.'}
        </p>

        <form onSubmit={reset ? submitReset : signin ? submitIn : submitUp} className="mt-7 space-y-4">
          {!signin && !reset && <Field icon={<User className="h-3.5 w-3.5" />} label="Seu nome" value={name} onChange={setName} autoComplete="name" />}
          <Field icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <Field icon={<Lock className="h-3.5 w-3.5" />} label={reset ? 'Nova senha' : 'Senha'} type={show ? 'text' : 'password'} value={pw} onChange={setPw} autoComplete={signin ? 'current-password' : 'new-password'} trailing={eye} invalid={!!error && !signin && pw.length < 6} />
          {meter}
          {!signin && <Field icon={<Lock className="h-3.5 w-3.5" />} label="Repita a senha" type={show ? 'text' : 'password'} value={pw2} onChange={setPw2} autoComplete="new-password" invalid={!!pw2 && pw2 !== pw} />}

          {reset ? null : signin ? (
            <div className="flex items-center justify-between gap-3 px-1 text-[13px] text-sub">
              <label className="flex min-h-11 items-center gap-2.5">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-[22px] w-[22px] accent-[rgb(var(--ink))]" />
                Lembrar de mim
              </label>
              <button type="button" onClick={() => go('reset', 'forward')} className="min-h-11 font-medium text-ink underline underline-offset-4">
                Esqueci a senha
              </button>
            </div>
          ) : (
            <label className="flex items-start gap-2.5 px-1 text-[13px] leading-snug text-sub">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-[22px] w-[22px] shrink-0 accent-[rgb(var(--ink))]" />
              Concordo com os termos de uso. Meus dados ficam guardados neste aparelho.
            </label>
          )}

          {error && (
            <p role="alert" className="anim-fade-in rounded-2xl bg-red-500/10 px-4 py-3 text-[13px] text-red-500">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy || !ready} className="glass-ink press h-[54px] w-full rounded-full text-[15px] font-medium disabled:opacity-50">
            {busy ? 'Aguarde…' : reset ? 'Salvar nova senha' : signin ? 'Entrar' : 'Criar minha conta'}
          </button>
        </form>

        <p className="mt-auto pt-8 text-center text-[13px] text-sub">
          {signin ? 'Ainda não tem conta? ' : reset ? 'Lembrou a senha? ' : 'Já tem conta? '}
          <button onClick={() => go(signin ? 'signup' : 'signin', 'forward')} className="min-h-11 font-medium text-ink underline underline-offset-4">
            {signin ? 'Criar conta' : 'Entrar'}
          </button>
        </p>
      </div>
    </Shell>
  );
};
