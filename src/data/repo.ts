/**
 * Camada única de dados do Void.
 * Hoje tudo fica no aparelho (localStorage). Para ligar o backend (Supabase) basta trocar o
 * adaptador com `useAdapter(...)`: as telas e os hooks não mudam.
 */
export interface DataAdapter {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

const local: DataAdapter = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* sem espaço ou sem permissão */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* sem permissão */
    }
  },
};

let current: DataAdapter = local;

/** Troca onde os dados ficam (ex.: Supabase). */
export function useAdapter(adapter: DataAdapter) {
  current = adapter;
}

export const repo: DataAdapter = {
  get: (k, f) => current.get(k, f),
  set: (k, v) => current.set(k, v),
  remove: (k) => current.remove(k),
};

/** Todas as chaves num só lugar. As por pessoa levam o e-mail no fim. */
export const KEYS = {
  conversations: 'void_web_conversations',
  activeId: 'void_web_active_id',
  manuals: 'void_web_manuals',
  profile: 'void_web_profile',
  plan: (email: string) => 'void_web_plan:' + email,
  usage: (email: string) => 'void_web_usage:' + email,
  waitlist: (email: string) => 'void_web_waitlist:' + email,
};
