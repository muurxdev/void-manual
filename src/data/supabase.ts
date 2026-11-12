import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import { FunctionsClient } from '@supabase/functions-js';

// URL e chave PÚBLICA (publishable) do projeto. Elas podem ficar no app; o que protege os dados
// são as regras de acesso do banco. Chaves secretas ficam só nas funções do servidor.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || 'https://kyawbscfuilchgqihyyl.supabase.co';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_XwJIkgSm74D_QQTwUiwG1A_KHR7hToP';

// Só login, banco e funções: sem tempo real nem arquivos, que o app não usa (pacote bem menor).
const auth = new AuthClient({
  url: SUPABASE_URL + '/auth/v1',
  headers: { apikey: SUPABASE_KEY },
  storageKey: 'sb-kyawbscfuilchgqihyyl-auth-token',
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
});

/** fetch que já leva a chave e o token da pessoa logada */
const authedFetch: typeof fetch = async (input, init) => {
  const { data } = await auth.getSession();
  const headers = new Headers(init?.headers);
  headers.set('apikey', SUPABASE_KEY);
  headers.set('Authorization', 'Bearer ' + (data.session?.access_token ?? SUPABASE_KEY));
  return fetch(input, { ...init, headers });
};

const db = new PostgrestClient(SUPABASE_URL + '/rest/v1', { headers: { apikey: SUPABASE_KEY }, fetch: authedFetch });
const functions = new FunctionsClient(SUPABASE_URL + '/functions/v1', { headers: { apikey: SUPABASE_KEY }, customFetch: authedFetch });

export const supabase = {
  auth,
  functions,
  rpc: db.rpc.bind(db),
  from: db.from.bind(db),
};
