# Void · Guia de design (fonte única)

Tudo abaixo vale para TODAS as telas. Não use valores soltos (`text-[13px]`, `rounded-[17px]`): use os tokens.

## Tipografia (Plus Jakarta Sans; mono só para valores técnicos)
| Token Tailwind | Tamanho / linha | Uso |
|---|---|---|
| `text-caption` | 12 / 16 | etiquetas, metadados, rótulos de seção |
| `text-small` | 13 / 18 | subtítulos, texto secundário, botões pequenos |
| `text-body` | 15 / 22 | texto padrão, títulos de linha, botões |
| `text-title` | 20 / 26 | título de folha e de bloco |
| `text-heading` | 26 / 30 | números de preço, títulos de cartão grande |
| `text-display` | 34 / 38 | saudação (Home e Chat) |
Pesos: normal (texto), `font-medium` (títulos de linha, botões), `font-semibold` (só preços). Cores: `text-ink`, `text-sub`, `text-mute`.

## Forma e tamanho
- Raios: pílula/botão `rounded-full` · cartão `rounded-[22px]` · chip pequeno `rounded-[14px]` · folha/diálogo `rounded-[30px]`.
- Botão de ícone: 44 (`icon-btn`, cabeçalhos) ou 48 (controles da tela de voz). Botão principal: 56 de altura. Mic da voz: 92.
- Gutter lateral: `clamp(16px, 5.6vw, 40px)`.

## Vidro (Liquid Glass v2, igual no iOS e no Android)
- `.glass` botões, pílulas e barras flutuantes · `.glass-strong` avisos e diálogos · `.glass-ink` ação principal (escura) · `.menu-surface` menus · `.card` cartões.
- Todo botão de vidro tem a **borda infinita** (`loop-border`): anel completo + feixe de luz girando (2,8 s). Em `.glass-ink` o feixe é branco.
- Conteúdo de leitura (listas longas, folhas, telas cheias) é opaco.

## Movimento (tokens em `index.css`)
- Padrão do Tailwind: toda `transition` usa 280 ms com `cubic-bezier(.16,1,.3,1)`; só animar `transform` e `opacity`.
- Folha: sobe de baixo (`--sheet-ease`). Chat e Voz: crescem do ponto do toque e voltam a ele. Menu: sobe de baixo, sem piscar.
- Respeitar `prefers-reduced-motion`.

## Voice
- Fita de linhas nas cores do sistema (`--ink`), borda infinita em todos os botões, título "VOID VOICE" em pílula, três controles nos cantos e no centro (teclado · microfone · chat).
