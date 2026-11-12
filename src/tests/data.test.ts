import { describe, expect, it } from 'vitest';
import { KEYS, repo, useAdapter, type DataAdapter } from '../data/repo';
import { passwordStrength } from '../data/auth';
import { generateLocalAnswer, searchManuals } from '../data/rag';

describe('camada de dados', () => {
  it('troca o adaptador sem mudar quem usa', () => {
    const mem: Record<string, string> = {};
    const fake: DataAdapter = {
      get: (k, f) => (k in mem ? JSON.parse(mem[k]) : f),
      set: (k, v) => void (mem[k] = JSON.stringify(v)),
      remove: (k) => void delete mem[k],
    };
    useAdapter(fake);
    repo.set(KEYS.plan('a@b.c'), 'pro');
    expect(repo.get(KEYS.plan('a@b.c'), 'free')).toBe('pro');
    expect(repo.get(KEYS.plan('outro@b.c'), 'free')).toBe('free');
    repo.remove(KEYS.plan('a@b.c'));
    expect(repo.get(KEYS.plan('a@b.c'), 'free')).toBe('free');
  });
});

describe('senha', () => {
  it('mede a força de 0 a 4', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(1);
    expect(passwordStrength('Abcdefghij1!')).toBeGreaterThanOrEqual(3);
  });
});

describe('respostas locais', () => {
  it('não repete a mesma linha de manual duas vezes', () => {
    const found = searchManuals('torque cabecote CB 500F');
    const texts = found.map((c) => c.text.toLowerCase().replace(/\s+/g, ' '));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('sem referência, orienta o que informar', () => {
    const r = generateLocalAnswer('xyzqwk');
    expect(r.citations).toHaveLength(0);
    expect(r.text).toContain('Modelo e cilindrada');
  });
});
