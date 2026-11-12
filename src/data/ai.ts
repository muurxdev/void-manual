import { supabase } from './supabase';
import { searchManuals } from './rag';
import type { Manual } from './types';

export class AiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export interface AiResult {
  text: string;
  plan: string;
  /** perguntas que ainda restam hoje (null = sem limite) */
  left: number | null;
  citations: { title: string; line: number; text: string }[];
}

/**
 * Pergunta à IA no servidor. Os trechos de manual mais parecidos com a pergunta vão junto,
 * e a IA só pode responder com eles. Quem chama decide o que fazer em caso de erro (ex.: motor local).
 */
export async function askAI(opts: { question: string; manuals: Manual[]; history: { q: string; a: string }[]; mode: 'chat' | 'voice' }): Promise<AiResult> {
  const citations = searchManuals(opts.question, opts.manuals, 6).map((c) => ({ title: c.title, line: c.line ?? 0, text: c.text }));
  const { data, error } = await supabase.functions.invoke('ask', {
    body: { question: opts.question, context: citations.map((c) => ({ title: c.title, text: c.text })), history: opts.history, mode: opts.mode },
  });
  if (error) {
    let code = 'rede';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.clone === 'function') {
      try {
        code = (await ctx.clone().json())?.error ?? 'erro';
      } catch {
        code = 'erro';
      }
    }
    throw new AiError(code);
  }
  if (!data?.text) throw new AiError('vazio');
  return { text: data.text, plan: data.plan, left: data.left ?? null, citations };
}
