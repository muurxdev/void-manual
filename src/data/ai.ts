import { supabase, SUPABASE_URL, SUPABASE_KEY } from './supabase';
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

/**
 * Igual à anterior, mas a resposta chega pedaço por pedaço (SSE): `onText` recebe o texto inteiro até agora.
 * `signal` permite parar no meio.
 */
export async function askAIStream(
  opts: { question: string; manuals: Manual[]; history: { q: string; a: string }[] },
  onText: (textSoFar: string) => void,
  signal?: AbortSignal
): Promise<AiResult> {
  const citations = searchManuals(opts.question, opts.manuals, 6).map((c) => ({ title: c.title, line: c.line ?? 0, text: c.text }));
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AiError('login');

  const r = await fetch(SUPABASE_URL + '/functions/v1/ask', {
    method: 'POST',
    signal,
    headers: { Authorization: 'Bearer ' + token, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: opts.question, context: citations.map((c) => ({ title: c.title, text: c.text })), history: opts.history, mode: 'chat', stream: true }),
  });
  if (!r.ok || !r.body) {
    let code = 'rede';
    try {
      code = (await r.json())?.error ?? 'erro';
    } catch {
      code = 'erro';
    }
    throw new AiError(code);
  }

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let text = '';
  let plan = 'free';
  let left: number | null = null;
  let finished = false;
  while (!finished) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = block.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      let ev: { delta?: string; done?: boolean; error?: string; plan?: string; left?: number | null };
      try {
        ev = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (ev.error) throw new AiError(ev.error);
      if (ev.delta) {
        text += ev.delta;
        onText(text);
      }
      if (ev.done) {
        plan = ev.plan ?? plan;
        left = ev.left ?? null;
        finished = true;
      }
    }
  }
  if (!text.trim()) throw new AiError('vazio');
  return { text: text.trim(), plan, left, citations };
}
