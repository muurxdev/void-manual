import { supabase } from './supabase';

/**
 * Login por código de 6 dígitos enviado por e-mail (Resend), sem senha.
 * Quem entra pela primeira vez já cria a conta; o e-mail é comprovado pelo próprio código.
 */
export interface Account {
  email: string;
  name: string;
}

const MESSAGES: Record<string, string> = {
  email_invalido: 'Esse e-mail não parece certo.',
  aguarde: 'Espere um minuto para pedir outro código.',
  muitas_tentativas: 'Muitas tentativas. Peça um código novo daqui a pouco.',
  email_indisponivel: 'O envio de e-mail ainda não está ativo. Tente de novo em instantes.',
  envio_falhou: 'Não consegui enviar o e-mail agora. Tente de novo.',
  codigo_invalido: 'Digite os 6 números do código.',
  codigo_expirado: 'O código expirou. Peça um novo.',
  codigo_errado: 'Código errado. Confira o e-mail e tente de novo.',
  falha_interna: 'Algo falhou do nosso lado. Tente de novo.',
};

/** Lê o erro devolvido pela função e o traduz para uma frase simples. */
async function readError(err: unknown): Promise<string> {
  const ctx = (err as { context?: Response })?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const j = await ctx.clone().json();
      if (j?.error && MESSAGES[j.error]) return MESSAGES[j.error];
    } catch {
      /* sem corpo */
    }
  }
  return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
}

const toAccount = (u: { email?: string | null; user_metadata?: { name?: string } }): Account => ({
  email: u.email ?? '',
  name: u.user_metadata?.name || (u.email ?? '').split('@')[0],
});

export async function sendCode(email: string, name?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('send-code', { body: { email, name } });
  if (error) throw new Error(await readError(error));
}

export async function verifyCode(email: string, code: string): Promise<Account> {
  const { data, error } = await supabase.functions.invoke('verify-code', { body: { email, code } });
  if (error || !data?.token_hash) throw new Error(error ? await readError(error) : MESSAGES.falha_interna);
  const res = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
  if (res.error || !res.data.user) throw new Error(MESSAGES.falha_interna);
  return toAccount(res.data.user);
}

export async function currentAccount(): Promise<Account | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ? toAccount(data.session.user) : null;
}

/** Avisa quando a sessão muda (entrou, saiu, expirou). */
export function onAccountChange(cb: (a: Account | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session ? toAccount(session.user) : null));
  return () => data.subscription.unsubscribe();
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
