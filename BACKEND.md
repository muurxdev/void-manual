# Backend do Void (Supabase)

Projeto: `void-manual` (`kyawbscfuilchgqihyyl`, região São Paulo). URL: https://kyawbscfuilchgqihyyl.supabase.co

## O que existe
| Peça | Onde | Para quê |
|---|---|---|
| Tabelas `profiles`, `conversations`, `messages` | banco | dados da pessoa (regras: cada um só vê o seu) |
| `subscriptions`, `usage_daily`, `waitlist` | banco | plano, perguntas do dia e lista de espera |
| `login_codes` | banco | códigos de 6 dígitos (só o servidor acessa) |
| `use_question()`, `undo_question()`, `plano_atual()` | banco | limite do plano aplicado no servidor |
| Função `send-code` | borda | envia o código por e-mail (Resend) |
| Função `verify-code` | borda | confere o código e devolve um token de uso único |
| Função `ask` | borda | exige login, conta a pergunta no plano e responde com IA (NVIDIA) |

## Segredos das funções (nunca no GitHub)
`NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM`. Depois: `GOOGLE_TTS_API_KEY`, `GROQ_API_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`.

Para enviar do `.env` do Void sem mostrar os valores:
```bash
npx supabase login        # uma vez
bash scripts/configurar-segredos.sh ../.env
```

## IA
Modelo principal `nvidia/nemotron-3-ultra-550b-a55b` (cerca de 3,5 s), reserva `nvidia/nemotron-3.5-bolt-e4b` (cerca de 1 s). Testados em 2026-11-12; a lista de modelos da NVIDIA mostra mais do que a chave consegue chamar.

## No app
`src/data/auth.ts` (login por código), `src/data/ai.ts` (chama a função `ask`; se falhar usa o motor do aparelho), `src/data/usePlan.ts` (plano e uso vindos do servidor).
