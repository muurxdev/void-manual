import React, { useEffect, useState } from 'react';
import { Check, CreditCard, Copy, Gem, QrCode, ShieldCheck, Tag, Lock } from 'lucide-react';
import { ScreenPanel } from './Panels';
import { Group, Row, Segmented, Toggle } from './Rows';
import { useFeedback } from './Feedback';
import { ANNUAL_DISCOUNT, COUPONS, PAYMENTS_LIVE, chargeTotal, isValidCpf, maskCpf, money, monthlyPrice, type Plan, type PlanId, type Usage } from '../data/plans';

interface Props {
  plan: Plan;
  plans: Plan[];
  usage: Usage;
  filesCount: number;
  waitlist: PlanId[];
  onJoin: (id: PlanId) => void;
  onClose: () => void;
  email?: string;
  name?: string;
}

type Step = 'plans' | 'checkout' | 'pix' | 'done';
type Method = 'pix' | 'card';

const Radio: React.FC<{ on: boolean }> = ({ on }) => (
  <span className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ' + (on ? 'border-ink bg-ink text-paper' : 'border-ink/25')}>{on && <Check className="h-3.5 w-3.5 stroke-[3]" />}</span>
);

/** Faixa fixa embaixo: o dado (preço) vai dentro do botão, uma ação só. */
const Cta: React.FC<{ onClick: () => void; children: React.ReactNode; note?: string; disabled?: boolean }> = ({ onClick, children, note, disabled }) => (
  <div>
    <button onClick={onClick} disabled={disabled} className="glass-ink loop-border press h-14 w-full rounded-full text-body font-medium disabled:opacity-45">
      {children}
    </button>
    {note && (
      <p className="mt-2 flex items-center justify-center gap-1.5 text-caption text-mute">
        <Lock className="h-3 w-3" /> {note}
      </p>
    )}
  </div>
);

const Steps: React.FC<{ at: number }> = ({ at }) => (
  <div className="mb-5 flex gap-1.5" aria-hidden="true">
    {[0, 1, 2].map((n) => (
      <span key={n} className={'h-1 flex-1 rounded-full transition-colors ' + (n <= at ? 'bg-ink' : 'bg-ink/10')} />
    ))}
  </div>
);

const protocol = () => 'VD-' + Date.now().toString(36).toUpperCase().slice(-6);

/** Planos e checkout em 4 passos: escolher, finalizar (dados, cupom, forma de pagamento), pagar e recibo. Cartão e Pix serão do Mercado Pago; até lá, o pedido entra na lista de espera. */
export const PlansPanel: React.FC<Props> = ({ plan, plans, usage, filesCount, waitlist, onJoin, onClose, email = '', name = '' }) => {
  const fb = useFeedback();
  const paid = plans.filter((p) => p.price > 0 && p.id !== plan.id);
  const [step, setStep] = useState<Step>('plans');
  const [annual, setAnnual] = useState(false);
  const [pick, setPick] = useState<PlanId>((paid.find((p) => p.highlight) ?? paid[0] ?? plans[1]).id);
  const [method, setMethod] = useState<Method>('pix');
  const [fullName, setFullName] = useState(name);
  const [cpf, setCpf] = useState('');
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [agree, setAgree] = useState(false);
  const [receipt, setReceipt] = useState({ id: '', at: '' });
  const chosen = plans.find((p) => p.id === pick) ?? plans[1];

  const qMax = plan.limits.questionsPerDay;
  const left = qMax === null ? null : Math.max(0, qMax - usage.questions);
  const base = chargeTotal(chosen, annual);
  const off = base * discount;
  const total = base - off;
  const cpfOk = isValidCpf(cpf);
  const nameOk = fullName.trim().split(/\s+/).length >= 2;
  const ready = cpfOk && nameOk && agree;

  const applyCoupon = () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    const d = COUPONS[code];
    if (d === undefined) {
      setDiscount(0);
      fb.toast('Cupom não encontrado', 'error');
      return;
    }
    setDiscount(d);
    fb.toast('Cupom aplicado: ' + Math.round(d * 100) + '% de desconto');
  };

  const finish = () => {
    setReceipt({ id: protocol(), at: new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) });
    setStep('done');
  };

  const pay = async () => {
    if (!PAYMENTS_LIVE) {
      const ok = await fb.confirm({
        title: 'Pagamento abre em breve',
        message: 'Ainda não dá para pagar. Você entra na lista de espera do ' + chosen.name + ' e avisamos assim que abrir. Nada será cobrado agora.',
        confirmLabel: 'Entrar na lista',
      });
      if (!ok) return;
      onJoin(chosen.id);
      finish();
      return;
    }
    if (method === 'pix') setStep('pix');
    else fb.toast('Abrindo o ambiente seguro do Mercado Pago…', 'info');
  };

  /* ---------- 4. recibo ---------- */
  if (step === 'done') {
    return (
      <ScreenPanel title="Pronto" onClose={onClose} footer={<Cta onClick={onClose}>Voltar ao Void</Cta>}>
        <Steps at={2} />
        <div className="flex flex-col items-center pb-6 pt-4 text-center">
          <span className="glass-ink anim-pop flex h-20 w-20 items-center justify-center rounded-full">
            <Check className="h-9 w-9 stroke-[3]" />
          </span>
          <h2 className="mt-5 text-heading font-medium">{PAYMENTS_LIVE ? 'Assinatura confirmada' : 'Você está na lista'}</h2>
          <p className="mt-2 max-w-[300px] text-body text-sub">{PAYMENTS_LIVE ? 'Seu plano ' + chosen.name + ' já está valendo.' : 'Assim que o pagamento abrir, avisamos você para ativar o plano ' + chosen.name + '.'}</p>
        </div>
        <Group title="Resumo">
          <Row label="Plano" value={chosen.name + (annual ? ' · anual' : ' · mensal')} />
          <Row label={PAYMENTS_LIVE ? 'Total pago' : 'Total previsto'} value={money(total)} />
          <Row label="Data" value={receipt.at} />
          <Row label="Protocolo" value={<span className="font-mono">{receipt.id}</span>} />
        </Group>
      </ScreenPanel>
    );
  }

  /* ---------- 3. Pix ---------- */
  if (step === 'pix') {
    return <PixStep total={total} onBack={() => setStep('checkout')} onClose={onClose} onPaid={finish} />;
  }

  /* ---------- 2. finalizar ---------- */
  if (step === 'checkout') {
    return (
      <ScreenPanel
        title="Finalizar"
        subtitle="Revise e escolha como pagar"
        onClose={onClose}
        onBack={() => setStep('plans')}
        footer={
          <Cta onClick={pay} disabled={!ready} note="Pagamento seguro pelo Mercado Pago">
            Pagar {money(total)} {method === 'pix' ? 'com Pix' : 'no cartão'}
          </Cta>
        }
      >
        <Steps at={1} />

        <Group title="Resumo">
          <Row icon={<Gem className="h-4 w-4" />} label={'Plano ' + chosen.name} hint={annual ? 'Cobrança anual' : 'Cobrança mensal'} value={money(base)} />
          {discount > 0 && <Row label={'Cupom ' + coupon.trim().toUpperCase()} value={'- ' + money(off)} />}
          {annual && <Row label={'Desconto anual · ' + Math.round(ANNUAL_DISCOUNT * 100) + '%'} hint="já incluído no total" />}
          <div className="flex items-baseline justify-between gap-3 px-3.5 py-3.5">
            <span className="text-body font-medium">Total hoje</span>
            <span className="text-heading font-semibold">{money(total)}</span>
          </div>
        </Group>

        <Group title="Cupom">
          <div className="flex items-center gap-2 p-2.5">
            <Tag className="ml-1.5 h-4 w-4 shrink-0 text-mute" />
            <input value={coupon} onChange={(e) => setCoupon(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCoupon())} placeholder="Tem um cupom?" autoCapitalize="characters" className="min-h-10 min-w-0 flex-1 bg-transparent text-body uppercase placeholder:normal-case placeholder:text-mute focus:outline-none" />
            <button type="button" onClick={applyCoupon} disabled={!coupon.trim()} className="glass loop-border press min-h-10 rounded-full px-4 text-small font-medium disabled:opacity-40">
              Aplicar
            </button>
          </div>
        </Group>

        <Group title="Dados de cobrança" footer="O CPF é exigido pelo Mercado Pago para emitir o recibo. Não guardamos o número do cartão.">
          <label className="block px-3.5 py-2.5">
            <span className="block text-caption text-mute">Nome completo</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" className="mt-0.5 w-full bg-transparent text-body font-medium focus:outline-none" />
            {fullName && !nameOk && <span className="text-caption text-red-500">Informe nome e sobrenome</span>}
          </label>
          <label className="block px-3.5 py-2.5">
            <span className="block text-caption text-mute">CPF</span>
            <input value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" className="mt-0.5 w-full bg-transparent font-mono text-body font-medium focus:outline-none" />
            {cpf.length === 14 && !cpfOk && <span className="text-caption text-red-500">CPF inválido</span>}
          </label>
          <Row label="E-mail do recibo" hint={email || 'Sua conta'} />
        </Group>

        <Group title="Como pagar">
          {(
            [
              { id: 'pix' as const, icon: <QrCode className="h-4 w-4" />, t: 'Pix', s: 'Aprovação na hora', tag: 'Mais rápido' },
              { id: 'card' as const, icon: <CreditCard className="h-4 w-4" />, t: 'Cartão de crédito', s: 'Você digita os dados no ambiente seguro do Mercado Pago', tag: '' },
            ] as const
          ).map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)} className="press flex min-h-[64px] w-full items-center gap-3 px-3.5 py-2.5 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fill">{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-body font-medium">
                  {m.t}
                  {m.tag && <span className="rounded-full bg-fill px-2 py-0.5 text-caption font-medium text-sub">{m.tag}</span>}
                </span>
                <span className="block text-caption text-sub">{m.s}</span>
              </span>
              <Radio on={method === m.id} />
            </button>
          ))}
        </Group>

        <Group>
          <Row label="Li e aceito os Termos e a Política de Privacidade" hint={annual ? 'Renova uma vez por ano. Cancele quando quiser.' : 'Renova todo mês. Cancele quando quiser.'} right={<Toggle on={agree} onChange={setAgree} label="Aceitar os termos" />} />
        </Group>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-caption text-mute">
          <ShieldCheck className="h-3.5 w-3.5" /> Seus dados de pagamento não passam pelo Void.
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
        <Cta onClick={() => setStep('checkout')} note="Cancele quando quiser">
          Continuar com o {chosen.name} · {money(monthlyPrice(chosen, annual))}/mês
        </Cta>
      }
    >
      <Steps at={0} />
      <Group title="Seu plano agora">
        <Row icon={<Gem className="h-4 w-4" />} label={plan.name} hint={plan.tagline} />
        {qMax !== null && (
          <div className="px-3.5 py-3">
            <div className="mb-1.5 flex justify-between text-small text-sub">
              <span>Perguntas hoje</span>
              <span className="font-mono text-ink">
                {usage.questions} de {qMax}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={qMax} aria-valuenow={Math.min(usage.questions, qMax)}>
              <div className="h-full origin-left rounded-full bg-ink transition-transform duration-300" style={{ transform: 'scaleX(' + Math.min(1, usage.questions / qMax) + ')' }} />
            </div>
            {left === 0 && <p className="mt-1.5 text-caption text-sub">Acabaram por hoje. Voltam à meia-noite ou com um plano maior.</p>}
          </div>
        )}
        <Row label="Arquivos seus" value={<span className="font-mono text-ink">{plan.limits.files === null ? filesCount + ' · sem limite' : filesCount + ' de ' + plan.limits.files}</span>} />
      </Group>

      <div className="mt-6">
        <Segmented
          label="Cobrança"
          value={annual ? 'a' : 'm'}
          onChange={(v) => setAnnual(v === 'a')}
          options={[
            { id: 'm', label: 'Mensal' },
            { id: 'a', label: 'Anual · ' + Math.round(ANNUAL_DISCOUNT * 100) + '% off' },
          ]}
        />
      </div>

      <div role="radiogroup" aria-label="Planos" className="mt-4 space-y-3">
        {paid.map((p) => {
          const on = pick === p.id;
          return (
            <button key={p.id} role="radio" aria-checked={on} onClick={() => setPick(p.id)} className={'card press block w-full p-4 text-left transition-colors ' + (on ? '!border-ink !border-2' : '')}>
              <span className="flex items-start gap-3">
                <span className="mt-0.5">
                  <Radio on={on} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-title font-medium">{p.name}</span>
                    {p.highlight && <span className="rounded-full bg-ink px-2.5 py-0.5 text-caption font-medium text-paper">Mais escolhido</span>}
                    {waitlist.includes(p.id) && <span className="rounded-full bg-fill px-2.5 py-0.5 text-caption font-medium text-sub">Na lista</span>}
                  </span>
                  <span className="block text-small text-sub">{p.tagline}</span>
                </span>
                <span className="text-right">
                  <span className="block text-heading font-semibold leading-none">{money(monthlyPrice(p, annual))}</span>
                  <span className="mt-1 block text-caption text-mute">por mês</span>
                </span>
              </span>
              <ul className="mt-3.5 space-y-2 border-t border-hair pt-3.5">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-body">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              {annual && <p className="mt-3 text-caption text-mute">Cobrado {money(chargeTotal(p, true))} uma vez por ano</p>}
            </button>
          );
        })}
      </div>
    </ScreenPanel>
  );
};

/** Pix: QR e código copia e cola, com contagem de tempo. O código real vem do Mercado Pago quando o pagamento estiver ligado. */
const PixStep: React.FC<{ total: number; onBack: () => void; onClose: () => void; onPaid: () => void }> = ({ total, onBack, onClose, onPaid }) => {
  const fb = useFeedback();
  const [sec, setSec] = useState(30 * 60);
  useEffect(() => {
    const id = window.setInterval(() => setSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const code = '00020126…(código Pix gerado pelo Mercado Pago)';
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return (
    <ScreenPanel title="Pague com Pix" subtitle={'Valor ' + money(total)} onClose={onClose} onBack={onBack} footer={<Cta onClick={onPaid}>Já paguei</Cta>}>
      <Steps at={1} />
      <div className="card flex flex-col items-center p-5 text-center">
        <div className="flex h-44 w-44 items-center justify-center rounded-[22px] bg-fill text-mute">
          <QrCode className="h-16 w-16" />
        </div>
        <p className="mt-3 text-small text-sub">
          Expira em <span className="font-mono text-ink">{mm}:{ss}</span>
        </p>
      </div>
      <Group title="Copia e cola">
        <Row label="Código Pix" hint={code} onClick={() => navigator.clipboard?.writeText(code).then(() => fb.toast('Código copiado'))} right={<Copy className="h-4 w-4 shrink-0 text-mute" />} />
      </Group>
    </ScreenPanel>
  );
};
