/**
 * Planos do Void. Os preços e limites abaixo são SUGESTÕES para validar: mude só aqui.
 * A cobrança de verdade depende do backend (pagamento); até lá "Assinar" entra na lista de espera.
 */
export type PlanId = 'free' | 'pro' | 'shop';

export interface PlanLimits {
  /** perguntas por dia (texto ou voz); null = sem limite */
  questionsPerDay: number | null;
  /** arquivos próprios na biblioteca; null = sem limite */
  files: number | null;
  /** tamanho máximo por arquivo, em MB */
  fileMb: number;
  /** pessoas na mesma conta */
  seats: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** preço mensal em reais (0 = grátis) */
  price: number;
  tagline: string;
  features: string[];
  limits: PlanLimits;
  highlight?: boolean;
}

export const ANNUAL_DISCOUNT = 0.2;

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Grátis',
    price: 0,
    tagline: 'Para conhecer o Void',
    features: ['10 perguntas por dia', 'Manuais incluídos no Void', 'Até 3 arquivos seus', 'Voz e chat'],
    limits: { questionsPerDay: 10, files: 3, fileMb: 10, seats: 1 },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29.9,
    tagline: 'Para quem trabalha todo dia',
    features: ['Perguntas sem limite', 'Até 100 arquivos seus', 'Arquivos de até 50 MB', 'Exportar conversas e checklists', 'Prioridade nas respostas'],
    limits: { questionsPerDay: null, files: 100, fileMb: 50, seats: 1 },
    highlight: true,
  },
  {
    id: 'shop',
    name: 'Oficina',
    price: 79.9,
    tagline: 'Para a equipe inteira',
    features: ['Tudo do Pro', 'Até 5 pessoas na conta', 'Biblioteca compartilhada', 'Arquivos ilimitados', 'Suporte direto'],
    limits: { questionsPerDay: null, files: null, fileMb: 50, seats: 5 },
  },
];

export const planById = (id: PlanId | string | undefined): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0];

export const priceLabel = (p: Plan, annual: boolean): string => {
  if (p.price === 0) return 'R$ 0';
  const v = annual ? p.price * (1 - ANNUAL_DISCOUNT) : p.price;
  return 'R$ ' + v.toFixed(2).replace('.', ',');
};

export interface Usage {
  /** dia de hoje (aaaa-mm-dd) a que as contagens se referem */
  day: string;
  questions: number;
}

export const today = (d = new Date()): string => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export const freshUsage = (u: Usage | undefined, d = new Date()): Usage => (u && u.day === today(d) ? u : { day: today(d), questions: 0 });

/** Ainda pode perguntar hoje? `left` = quantas restam (null = sem limite). */
export function checkQuestion(plan: Plan, usage: Usage): { ok: boolean; left: number | null } {
  const max = plan.limits.questionsPerDay;
  if (max === null) return { ok: true, left: null };
  const left = Math.max(0, max - usage.questions);
  return { ok: left > 0, left };
}

/** Cabem mais `adding` arquivos? */
export function checkFiles(plan: Plan, current: number, adding: number): { ok: boolean; max: number | null; room: number | null } {
  const max = plan.limits.files;
  if (max === null) return { ok: true, max, room: null };
  const room = Math.max(0, max - current);
  return { ok: adding <= room, max, room };
}

/** Muda para true quando o Mercado Pago estiver ligado no servidor. Enquanto for false, "Pagar" entra na lista de espera. */
export const PAYMENTS_LIVE = false;

export const BILLING_MONTHS = 12;

/** Preço por mês no ciclo escolhido. */
export const monthlyPrice = (p: Plan, annual: boolean): number => (annual ? p.price * (1 - ANNUAL_DISCOUNT) : p.price);

/** Quanto é cobrado de uma vez no ciclo escolhido (12 meses no anual). */
export const chargeTotal = (p: Plan, annual: boolean): number => (annual ? monthlyPrice(p, true) * BILLING_MONTHS : p.price);

export const money = (v: number): string => 'R$ ' + v.toFixed(2).replace('.', ',');

/** Deixa só os números e aplica a máscara 000.000.000-00. */
export const maskCpf = (v: string): string => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
};

/** CPF válido pelos dois dígitos verificadores (rejeita 111.111.111-11 e parecidos). */
export function isValidCpf(v: string): boolean {
  const d = v.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** Cupons aceitos: percentual de desconto. Vazio até o backend validar os cupons de verdade. */
export const COUPONS: Record<string, number> = {};
