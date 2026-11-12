#!/usr/bin/env bash
# Envia as chaves do .env do Void para os segredos das funções no Supabase, sem mostrá-las na tela.
# Antes, uma vez: npx supabase login
set -euo pipefail
REF="kyawbscfuilchgqihyyl"
ENV_FILE="${1:-../.env}"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT
for k in NVIDIA_API_KEY NVIDIA_BASE_URL RESEND_API_KEY RESEND_FROM GOOGLE_TTS_API_KEY GROQ_API_KEY MERCADOPAGO_ACCESS_TOKEN MERCADOPAGO_WEBHOOK_SECRET; do
  grep -E "^${k}=" "$ENV_FILE" >> "$TMP" || true
done
echo "Segredos encontrados: $(cut -d= -f1 "$TMP" | tr '\n' ' ')"
npx supabase secrets set --env-file "$TMP" --project-ref "$REF"
echo "Pronto. Os valores não foram exibidos."
