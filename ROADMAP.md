# Void: melhorias adicionadas e o que o back-end precisa

Atualize a cada rodada. Cada item diz o que mudou, por que é mais profissional e o que o banco/servidor precisa.

## Navegação (rodada atual)
- **Um "+" central é o guia de tudo.** Fica visível em todas as telas e sobre as folhas. Lista: Nova conversa, Void Voice, Biblioteca, Adicionar arquivo, Conversas, Planos, Perfil, Configurações.
- **Folhas com X** (Biblioteca, Conversas, Planos, Perfil, Configurações, Termos): sobem de baixo, título fixo no topo (nada corta), arrastar para baixo fecha.
- **Telas cheias (Chat e Voz):** abrem expandindo do ponto do toque e voltam para ele (View Transitions + clip-path).
- **Menu suspenso:** sobe de baixo, sem vidro (acabou o flash branco/preto).
- **Telas carregadas em segundo plano** para abrir sem tela em branco.
- **Ícone de Planos:** gema (antes estrela, que lembrava IA).
- Atualização automática: o app se recarrega quando há versão nova.

## Back-end necessário (pendente)
- Sincronizar conversas, perfil e arquivos com o Supabase (hoje ficam no aparelho): tabelas `conversations`, `messages`, `profiles`, `library_items` + Storage para arquivos, RLS por usuário.
- Pagamento Mercado Pago: segredo `MERCADOPAGO_ACCESS_TOKEN`, função de checkout + webhook que atualiza `subscriptions`.
- Voz de IA profissional (Google Cloud TTS): `GOOGLE_TTS_API_KEY` + função `speak`.
- Transcrição (Groq/Whisper): `GROQ_API_KEY` + função `transcribe`.
- Resend com domínio verificado e `RESEND_FROM`.
- Excluir conta e exportar dados (LGPD): função `delete-account`.

## Checkout (adicionado em 2026-11-13) — o que o backend precisa
- Edge function `create-payment` (Mercado Pago): recebe plano, ciclo, método, nome e CPF; devolve link/ID do Checkout Pro (cartão) ou QR + copia e cola (Pix) e `expires_at`.
- Webhook `mp-webhook`: confirma o pagamento, grava `subscriptions` (user_id, plan, cycle, status, renews_at) e envia recibo por e-mail (Resend).
- Tabela `coupons` (code, percent, valid_until, max_uses) + checagem no servidor; hoje `COUPONS` em `plans.ts` está vazio.
- Tabela `invoices` (protocolo, valor, método, data) para o recibo e para "Assinatura" no Perfil.
- Cancelamento e troca de plano; renovação mensal/anual; e-mail de falha de pagamento.
- LGPD: CPF só em trânsito para o Mercado Pago, nunca gravado em claro.
- Troque `PAYMENTS_LIVE` para `true` em `plans.ts` quando o servidor estiver pronto.
