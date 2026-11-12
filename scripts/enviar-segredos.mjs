// Envia as chaves do .env do Void para o Vault do Supabase (criptografado), sem mostrar os valores.
// Uso: node scripts/enviar-segredos.mjs <arquivo-com-o-token-de-envio> [caminho-do-.env]
import { readFileSync } from 'node:fs';

const [tokenFile, envFile = '../.env'] = process.argv.slice(2);
const URL = 'https://kyawbscfuilchgqihyyl.supabase.co/functions/v1/setup-secrets';
const NAMES = ['NVIDIA_API_KEY', 'NVIDIA_BASE_URL', 'RESEND_API_KEY', 'RESEND_FROM', 'GOOGLE_TTS_API_KEY', 'GROQ_API_KEY', 'PAGBANK_TOKEN', 'PAGBANK_WEBHOOK_SECRET'];

const token = readFileSync(tokenFile, 'utf8').trim();
const env = readFileSync(envFile, 'utf8');
const secrets = {};
for (const n of NAMES) {
  const m = env.match(new RegExp('^' + n + '=(.*)$', 'm'));
  const v = m && m[1].trim().replace(/^["']|["']$/g, '');
  if (v) secrets[n] = v;
}
console.log('Encontrados no .env:', Object.keys(secrets).join(', ') || '(nenhum)');
const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-setup-token': token }, body: JSON.stringify({ secrets }) });
const j = await r.json();
console.log('Resposta:', r.status, JSON.stringify(j));
