import { describe, expect, it } from 'vitest';
import { PLANS, checkFiles, checkQuestion, freshUsage, planById, priceLabel, today } from '../data/plans';

describe('planos', () => {
  const free = planById('free');
  const pro = planById('pro');

  it('plano desconhecido cai no grátis', () => {
    expect(planById('xyz').id).toBe('free');
    expect(planById(undefined).id).toBe('free');
  });

  it('grátis tem limite de perguntas por dia; pro não', () => {
    expect(checkQuestion(free, { day: today(), questions: 9 })).toEqual({ ok: true, left: 1 });
    expect(checkQuestion(free, { day: today(), questions: 10 })).toEqual({ ok: false, left: 0 });
    expect(checkQuestion(pro, { day: today(), questions: 999 })).toEqual({ ok: true, left: null });
  });

  it('o uso zera quando o dia muda', () => {
    const ontem = new Date(2026, 10, 11);
    const hoje = new Date(2026, 10, 12);
    expect(freshUsage({ day: today(ontem), questions: 10 }, hoje).questions).toBe(0);
    expect(freshUsage({ day: today(hoje), questions: 4 }, hoje).questions).toBe(4);
  });

  it('limite de arquivos', () => {
    expect(checkFiles(free, 2, 1).ok).toBe(true);
    expect(checkFiles(free, 2, 2)).toMatchObject({ ok: false, max: 3, room: 1 });
    expect(checkFiles(planById('shop'), 5000, 10).ok).toBe(true);
  });

  it('preço mensal e anual com desconto', () => {
    expect(priceLabel(free, false)).toBe('R$ 0');
    expect(priceLabel(pro, false)).toBe('R$ 29,90');
    expect(priceLabel(pro, true)).toBe('R$ 23,92');
  });

  it('todo plano tem recursos e nome', () => {
    for (const p of PLANS) {
      expect(p.name).toBeTruthy();
      expect(p.features.length).toBeGreaterThan(2);
    }
  });
});
