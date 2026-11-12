import { createClient } from '@supabase/supabase-js';

// URL e chave PÚBLICA (publishable) do projeto. Elas podem ficar no app; o que protege os dados
// são as regras de acesso do banco. Chaves secretas ficam só nas funções do servidor.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || 'https://kyawbscfuilchgqihyyl.supabase.co';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_XwJIkgSm74D_QQTwUiwG1A_KHR7hToP';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
