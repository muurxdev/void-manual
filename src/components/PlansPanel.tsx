import React, { useState } from 'react';
import { Check, CreditCard, QrCode } from 'lucide-react';
import { ScreenPanel } from './Panels';
import { useFeedback } from './Feedback';
import { ANNUAL_DISCOUNT, PAYMENTS_LIVE, chargeTotal, money, monthlyPrice, type Plan, type PlanId, type Usage } from '../data/plans';

interface Props {
  plan: Plan;
  plans: Plan[];
  usage: Usage;
  filesCount: number;
  waitlist: PlanId[];
  onJoin: (id: PlanId) => void;
  onClose: () => void;
}

type Step = 'plans' | 'pay' | 'done';
type Method = 'pix' | 'card';

const Radio: React.FC<{ on: boolean }> = ({ on }) => (
  <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ' + (on ? 'border-ink bg-ink text-paper' : 'border-ink/25')}>
    {on && <Check className="h-3.5 w-3.5 stroke-[3]" />}
  </span>
);

/** Faixa fixa embaixo: o dado (preço) vai dentro do botão, uma ação só. */
const Cta: React.FC<{ onClick: () => void; children: React.ReactNode; note?: string; disabled?: boolean }> = ({ onClick, children, note, disabled }) => (
  <div>
    <button onClick={onClick} disabled={disabled} className="glass-ink press h-[56px] w-full rounded-full text-[16px] font-medium disabled:opacity-50">
      {children}
    </button>
    {note && <p className="mt-2 text-center text-[12px] text-mute">{note}</p>}
  </div>
);

/** Planos em 3 passos: escolher, pagar e confirmar. Cartão e Pix serão do PagBank; até lá, o pedido entra na lista de espera. */
export const PlansPanel: React.FC<Props> = ({ plan, plans, usage, filesCount, waitlist, onJoin, onClose }) => {
  const fb = useFeedback();
  const paid = plans.filter((p) => p.price > 0 && p.id !== plan.id);
  const [step, setStep] = useState<Step>('plans');
  const [annual, setAnnual] = useState(false);
  const [pick, setPick] = useState<PlanId>((paid.find((p) => p.highlight) ?? paid[0] ?? plans[1]).id);
  const [method, setMethod] = useState<Method>('pix');
  const chosen = plans.find((p) => p.id === pick) ?? plans[1];

  const qMax = plan.limits.questionsPerDay;
  const left = qMax === null ? null : Math.max(0, qMax - usage.questions);

  const pay = async () => {
    if (!PAYMENTS_LIVE) {
      const ok = await fb.confirm({
        title: 'Pagamento abre em breve',
        message: 'Ainda não dá para pagar. Você entra na lista de espera do ' + chosen.name + ' e avisamos assim que abrir.',
        confirmLabel: 'Entrar na lista',
      });
      if (!ok) return;
      onJoin(chosen.id);
      setStep('done');
      return;
    }
    fb.toast('Abrindo o pagamento seguro…', 'info');
  };

  const total = chargeTotal(chosen, annual);

  /* ---------- 3. confirmação ---------- */
  if (step === 'done') {
    return (
      <ScreenPanel title="Pronto" onClose={onClose} footer={<Cta onClick={onClose}>Voltar ao Void</Cta>}>
        <div className="flex flex-col items-center py-10 text-center">
          <span className="glass-ink anim-pop flex h-20 w-20 items-center justify-center rounded-full">
            <Check className="h-9 w-9 stroke-[3]" />
          </span>
          <h2 className="mt-6 text-[24px] font-medium tracking-tight">{PAYMENTS_LIVE ? 'Assinatura confirmada' : 'Você está na lista'}</h2>
          <p className="mt-2 max-w-[300px] text-[15px] leading-relaxed text-sub">
            {PAYMENTS_LIVE ? 'Seu plano ' + chosen.name + ' já está valendo.' : 'Assim que o pagamento abrir, avisamos você para ativar o plano ' + chosen.name + '.'}
          </p>
        </div>
      </ScreenPanel>
    );
  }

  /* ---------- 2. pagamento ---------- */
  if (step === 'pay') {
    return (
      <ScreenPanel
        title="Pagamento"
        subtitle="Passo 2 de 3"
        onClose={onClose}
        onBack={() => setStep('plans')}
        footer={
          <Cta onClick={pay} note="Pagamento seguro pelo PagBank">
            Pagar {money(total)} {method === 'pix' ? 'com Pix' : 'no cartão'}
          </Cta>
        }
      >
        <div className="mb-5 flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((n) => (
            <span key={n} className={'h-1 flex-1 rounded-full ' + (n <= 1 ? 'bg-ink' : 'bg-ink/10')} />
          ))}
        </div>

        <section className="card p-4">
          <h2 className="mb-3 text-[13px] font-medium uppercase tracking-[0.12em] text-mute">Resumo</h2>
          <dl className="space-y-2.5 text-[15px]">
            <div className="flex justify-between gap-3">
              <dt>
                Plano {chosen.name}
                <span className="block text-[12px] text-mute">{annual ? 'Cobrança anual' : 'Cobrança mensal'}</span>
              </dt>
              <dd className="font-medium">{money(chosen.price * (annual ? 12 : 1))}</dd>
            </div>
            {annual && (
              <div className="flex justify-between gap-3 text-sub">
                <dt>Desconto anual ({Math.round(ANNUAL_DISCOUNT * 100)}%)</dt>
                <dd>- {money(chosen.price * 12 - total)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3 border-t border-hair pt-3">
              <dt className="font-medium">Total hoje</dt>
              <dd className="text-[26px] font-semibold tracking-tight">{money(total)}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[13px] font-medium uppercase tracking-[0.12em] text-mute">Como pagar</h2>
          <div role="radiogroup" aria-label="Forma de pagamento" className="space-y-2">
            {(
              [
                { id: 'pix' as const, icon: <QrCode className="h-5 w-5" />, t: 'Pix', s: 'Aprovação na hora', tag: 'Mais rápido' },
                { id: 'card' as const, icon: <CreditCard className="h-5 w-5" />, t: 'Cartão de crédito', s: 'Você finaliza no ambiente seguro do PagBank', tag: '' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={method === m.id}
                onClick={() => setMethod(m.id)}
                className={'card press flex min-h-[68px] w-full items-center gap-3 p-3.5 text-left transition-colors ' + (method === m.id ? '!border-ink' : '')}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fill">{m.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-medium">
                    {m.t}
                    {m.tag && <span className="rounded-full bg-fill px-2 py-0.5 text-[12px] font-medium text-sub">{m.tag}</span>}
                  </span>
                  <span className="block text-[12.5px] text-sub">{m.s}</span>
                </span>
                <Radio on={method === m.id} />
              </button>
            ))}
          </div>
        </section>

        <p className="mt-4 px-1 text-[12.5px] leading-relaxed text-mute">
          {annual ? 'Renova uma vez por ano.' : 'Renova todo mês.'} Cancele quando quiser em Configurações. Seus dados de pagamento não passam pelo Void.
        </p>

      </ScreenPanel>
    );
  }

  /* ---------- 1. escolher ---------- */
  return (
    <ScreenPanel
      title="Planos"
      subtitle="Escolha como usar o Void"
      onClose={onClose}
      footer={
        <Cta onClick={() => setStep('pay')} note="Cancele quando quiser">
          Continuar com o {chosen.name} · {money(monthlyPrice(chosen, annual))}/mês
        </Cta>
      }
    >
      <section className="card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-sub">Seu plano agora</p>
          <p className="text-[15px] font-medium">{plan.name}</p>
        </div>
        <div className="mt-3 space-y-2.5">
          {qMax !== null && (
            <div>
              <div className="mb-1 flex justify-between text-[12.5px] text-sub">
                <span>Perguntas hoje</span>
                <span className="font-mono text-ink">
                  {usage.questions} de {qMax}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={qMax} aria-valuenow={Math.min(usage.questions, qMax)}>
                <div className="h-full origin-left rounded-full bg-ink transition-transform duration-500" style={{ transform: 'scaleX(' + Math.min(1, usage.questions / qMax) + ')' }} />
              </div>
              {left === 0 && <p className="mt-1.5 text-[12.5px] text-sub">Acabaram por hoje. Voltam à meia-noite ou com um plano maior.</p>}
            </div>
          )}
          <div className="flex justify-between text-[12.5px] text-sub">
            <span>Arquivos seus</span>
            <span className="font-mono text-ink">{plan.limits.files === null ? filesCount + ' · sem limite' : filesCount + ' de ' + plan.limits.files}</span>
          </div>
        </div>
      </section>

      <div role="radiogroup" aria-label="Cobrança" className="glass mx-auto mt-5 grid w-full grid-cols-2 gap-1 rounded-full p-1">
        {[false, true].map((a) => (
          <button
            key={String(a)}
            role="radio"
            aria-checked={annual === a}
            onClick={() => setAnnual(a)}
            className={'press min-h-11 rounded-full text-[14px] font-medium transition-colors ' + (annual === a ? 'bg-ink text-paper' : 'text-ink/70')}
          >
            {a ? 'Anual · ' + Math.round(ANNUAL_DISCOUNT * 100) + '% off' : 'Mensal'}
          </button>
        ))}
      </div>

      <div role="radiogroup" aria-label="Planos" className="mt-4 space-y-3">
        {paid.map((p) => {
          const on = pick === p.id;
          const inList = waitlist.includes(p.id);
          return (
            <button
              key={p.id}
              role="radio"
              aria-checked={on}
              onClick={() => setPick(p.id)}
              className={'card press block w-full p-4 text-left transition-colors ' + (on ? '!border-ink !border-2' : '')}
            >
              <span className="flex items-start gap-3">
                <span className="mt-0.5">
                  <Radio on={on} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[18px] font-medium">{p.name}</span>
                    {p.highlight && <span className="rounded-full bg-ink px-2.5 py-0.5 text-[12px] font-medium text-paper">Mais escolhido</span>}
                    {inList && <span className="rounded-full bg-fill px-2.5 py-0.5 text-[12px] font-medium text-sub">Na lista</span>}
                  </span>
                  <span className="block text-[13px] text-sub">{p.tagline}</span>
                </span>
                <span className="text-right">
                  <span className="block text-[22px] font-semibold leading-none tracking-tight">{money(monthlyPrice(p, annual))}</span>
                  <span className="mt-1 block text-[12px] text-mute">por mês</span>
                </span>
              </span>
              <ul className="mt-3.5 space-y-1.5 border-t border-hair pt-3.5">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[14px] leading-snug">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 stroke-[2.5]" /> {f}
                  </li>
                ))}
              </ul>
              {annual && <p className="mt-3 text-[12px] text-mute">Cobrado {money(chargeTotal(p, true))} uma vez por ano</p>}
            </button>
          );
        })}
      </div>

    </ScreenPanel>
  );
};
