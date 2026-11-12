import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import { ScreenPanel } from './Panels';
import { useFeedback } from './Feedback';
import { ANNUAL_DISCOUNT, priceLabel, type Plan, type PlanId, type Usage } from '../data/plans';

interface Props {
  plan: Plan;
  plans: Plan[];
  usage: Usage;
  filesCount: number;
  waitlist: PlanId[];
  onJoin: (id: PlanId) => void;
  onClose: () => void;
}

const Meter: React.FC<{ label: string; used: number; max: number | null }> = ({ label, used, max }) => (
  <div>
    <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
      <span className="text-sub">{label}</span>
      <span className="font-mono text-[12px] text-ink">{max === null ? 'Sem limite' : used + ' de ' + max}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={max ?? 100} aria-valuenow={max === null ? 100 : Math.min(used, max)}>
      <div className="h-full origin-left rounded-full bg-ink transition-transform duration-500" style={{ transform: 'scaleX(' + (max === null ? 1 : Math.min(1, used / Math.max(1, max))) + ')' }} />
    </div>
  </div>
);

/** Planos: o que cada um inclui, o uso de hoje e o pedido de assinatura (lista de espera até o pagamento abrir). */
export const PlansPanel: React.FC<Props> = ({ plan, plans, usage, filesCount, waitlist, onJoin, onClose }) => {
  const [annual, setAnnual] = useState(false);
  const fb = useFeedback();

  const subscribe = async (p: Plan) => {
    if (waitlist.includes(p.id)) {
      fb.toast('Você já está na lista do ' + p.name, 'info');
      return;
    }
    const ok = await fb.confirm({
      title: 'Quero o plano ' + p.name,
      message: 'O pagamento ainda não está aberto. Entro na lista de espera e avisamos assim que você puder assinar.',
      confirmLabel: 'Entrar na lista',
    });
    if (!ok) return;
    onJoin(p.id);
    fb.toast('Você está na lista do ' + p.name);
  };

  return (
    <ScreenPanel title="Planos" subtitle={'Seu plano: ' + plan.name} onClose={onClose}>
      <div className="card space-y-3 p-4">
        <p className="text-[13px] font-medium">Seu uso</p>
        <Meter label="Perguntas hoje" used={usage.questions} max={plan.limits.questionsPerDay} />
        <Meter label="Seus arquivos" used={filesCount} max={plan.limits.files} />
        {plan.limits.questionsPerDay !== null && <p className="text-[12px] text-mute">As perguntas voltam ao número cheio todo dia, à meia-noite.</p>}
      </div>

      <div role="radiogroup" aria-label="Cobrança" className="glass mx-auto mt-5 grid w-full max-w-[320px] grid-cols-2 gap-1 rounded-full p-1">
        {[false, true].map((a) => (
          <button
            key={String(a)}
            role="radio"
            aria-checked={annual === a}
            onClick={() => setAnnual(a)}
            className={'press min-h-11 rounded-full text-[13px] font-medium transition-colors ' + (annual === a ? 'bg-ink text-paper' : 'text-ink/70')}
          >
            {a ? 'Anual · -' + Math.round(ANNUAL_DISCOUNT * 100) + '%' : 'Mensal'}
          </button>
        ))}
      </div>

      <ul className="mt-5 space-y-3">
        {plans.map((p) => {
          const mine = p.id === plan.id;
          return (
            <li key={p.id} className={'card p-4 ' + (p.highlight ? 'ring-1 ring-ink/40' : '')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-1.5 text-[18px] font-medium">
                    {p.name}
                    {p.highlight && (
                      <span className="flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium text-paper">
                        <Sparkles className="h-3 w-3" /> Mais escolhido
                      </span>
                    )}
                  </h2>
                  <p className="text-[13px] text-sub">{p.tagline}</p>
                </div>
                <p className="text-right">
                  <span className="text-[22px] font-semibold tracking-tight">{priceLabel(p, annual)}</span>
                  {p.price > 0 && <span className="block text-[12px] text-mute">por mês{annual ? ', no plano anual' : ''}</span>}
                </p>
              </div>
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[14px] leading-snug">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 stroke-[2.5]" /> {f}
                  </li>
                ))}
              </ul>
              {mine ? (
                <p className="mt-4 flex h-12 items-center justify-center rounded-full border border-hair text-[14px] font-medium text-sub">Seu plano atual</p>
              ) : p.price === 0 ? null : (
                <button onClick={() => subscribe(p)} className={'press mt-4 h-12 w-full rounded-full text-[14px] font-medium ' + (p.highlight ? 'glass-ink' : 'glass')}>
                  {waitlist.includes(p.id) ? 'Você está na lista' : 'Quero o ' + p.name}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </ScreenPanel>
  );
};
