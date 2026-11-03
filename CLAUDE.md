# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Personalize Sendi — extensão de navegador (Manifest V3, Chrome/Edge/Firefox) que injeta recursos
no SaaS de atendimento **Sendi**: cronômetro por atendimento (com cores de SLA), tema
visual (papel de parede + cores extraídas da imagem), assistente de IA (Melhorar/Sugerir
resposta, motivo de finalização) e atalho para o sistema do cliente. Há um **Cloudflare
Worker** que faz proxy de IA com **fallback entre 3 provedores** (Groq → Gemini →
OpenRouter), mantendo as chaves fora da extensão.

**Status**: em adaptação do ChatPro para o Sendi (domínio e seletores DOM ainda pendentes; ver README).

Sem build, sem bundler, sem npm na extensão: JS puro carregado direto pelo `manifest.json`.

## Comandos

A extensão **não tem build nem testes**. Desenvolvimento = recarregar sem compactação.

```
# Instalar/recarregar a extensão
#   chrome://extensions → Modo do desenvolvedor → Carregar sem compactação → pasta extension/
#   Após editar arquivos, clicar em "Recarregar" no card da extensão.

# Worker (Cloudflare) — único componente com toolchain
cd worker
npx wrangler dev          # roda o Worker local
npx wrangler deploy       # publica
npx wrangler secret put GEMINI_API_KEY      # chave da Gemini
npx wrangler secret put GROQ_API_KEY        # chave do Groq
npx wrangler secret put OPENROUTER_API_KEY  # chave do OpenRouter
npx wrangler secret put SHARED_TOKEN        # token compartilhado extensão↔Worker (você inventa)

# Dashboards das chaves (onde gerar/rotacionar):
#   Gemini     https://aistudio.google.com/apikey
#   Groq       https://console.groq.com/keys
#   OpenRouter https://openrouter.ai/workspaces/default/keys
```

Não há lint nem suíte de testes em nenhum dos dois componentes.

## Publicação / empacotamento (lojas)

**REGRA**: toda correção ou alteração na extensão deve ser feita SEMPRE dentro de
`extension/` (os arquivos que vão para o pacote). Nada de patch fora dali. Após qualquer
mudança em `extension/`, considerar regerar o zip (abaixo) se for publicar.

Ao gerar um pacote para as lojas:
1. **Bumpar `version`** em `extension/manifest.json` (Chrome e Firefox rejeitam versão
   igual ou menor que a já enviada). Ex: `0.1.1` → `0.1.2`.
2. **Regerar o zip** com `/` nos caminhos (o `Compress-Archive` do Windows grava `\` e o
   AMO rejeita). Usar este comando (PowerShell):

```powershell
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = "C:\dev-projects\personalize-sendi\extension"
$out  = "C:\dev-projects\personalize-sendi\personalize-sendi-firefox.zip"
if (Test-Path $out) { Remove-Item $out -Force }
$zip = [System.IO.Compression.ZipFile]::Open($out, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem -Path $root -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length + 1).Replace('\','/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null
  }
} finally { $zip.Dispose() }
```

3. Subir o zip nas duas lojas (mesmo arquivo serve para ambas — ver abaixo). Cada upload
   passa por **nova revisão**.

- **Manifest dual** (Chrome + Firefox no mesmo arquivo): `background` tem `service_worker`
  (Chrome usa) E `scripts` (Firefox usa); `browser_specific_settings.gecko` tem `id`,
  `strict_min_version` e `data_collection_permissions` (`["personalCommunications"]`,
  exigido pelo AMO porque as mensagens do atendimento são enviadas à IA). O Chrome ignora
  `browser_specific_settings`; o Firefox ignora `service_worker`.
- **Privacidade**: política em `PRIVACY.md` (raiz) e a mesma versão em HTML servida pelo
  Worker em `GET /privacy` (constante `PRIVACY_HTML`) — a URL exigida pelas lojas. Declara o
  envio das mensagens à IA (Worker → Gemini/Groq/OpenRouter, não armazenadas) e o `<all_urls>`
  (para baixar a imagem de fundo). **Ao mexer nos provedores, atualizar os dois textos.**
- O `icon trans.png` na raiz é a fonte da arte; os ícones usados ficam em
  `extension/icons/` (16/32/48/128, gerados via Pillow com crop do bbox do alpha).

## Repositório (Git)

O `.gitignore` da raiz bloqueia o que NÃO pode ir para o GitHub:
`.env`, `.dev.vars`, `worker/.wrangler/` (o cache guarda o ID da conta Cloudflare),
`*.zip` (pacotes das lojas), `personalize-sendi-config-*.json` (backup do popup — contém o
`aiToken`) e `.claude/settings.local.json`. Nenhuma chave de IA fica no repositório: todas
são secrets do Worker (`wrangler secret put`).

## Arquitetura

Dois componentes independentes:

### 1. Extensão (`extension/`)
Content scripts carregados **em ordem** pelo manifest (cada um expõe um global `window.CPC_*`;
sem módulos ES, a ordem importa):

`selectors.js` → `storage.js` → `timer.js` → `theme.js` → `ai.js` → `clientlink.js` → `content.js`

- **`content.js`** — ponto de entrada. Um único `MutationObserver` no `document.body`
  (debounce 200ms) re-sincroniza timer + IA a cada mudança do DOM. O Sendi é uma SPA
  React, então tudo reage a mutações, não a navegação de página.
- **`selectors.js`** — `window.CPC_SELECTORS`: **todos** os seletores DOM do Sendi num só
  lugar. Se o Sendi mudar o layout e algo quebrar, comece aqui. `CPC_getCardId` extrai o
  UUID estável do atendimento do `href="/chat/<uuid>"` — é a chave primária de tudo.
- **`storage.js`** — `window.CPC_store`: wrapper de `chrome.storage.local`. Dois objetos:
  `cpc_timers` (`{ cardId: startedAt(ms) }`) e `cpc_prefs` (todas as preferências do popup).
  `getPrefs()` define os defaults — qualquer pref nova precisa de default aqui.
- **`timer.js`** — cronômetro por card. Início **AUTOMÁTICO** ao pegar o atendimento:
  - Listener de clique em capture-phase (`onAtenderClick`) detecta o botão "Atender"
    (regex `\batender\b`, não casa "atendimento"; texto ≤20 chars). No clique →
    `setTimerStart(activeCardId, Date.now())` (não reinicia se já existir). **Não** há
    botão flutuante para iniciar/parar — o pickup é o único gatilho.
  - `"Atendimento finalizado por…"` → remove o timer daquele card (`cleanupFinalized`).
  - Persistido por UUID: trocar de aba/recarregar não reinicia. `pruneOld` limpa timers
    com +24h (por idade, nunca por ausência no DOM).
  - SLA: verde até `slaYellow`min, amarelo até `slaRed`min, vermelho depois (config no popup,
    toggle `slaColors`).
- **`theme.js`** — substitui o fundo de rabiscos do chat por uma imagem via stylesheet
  injetado. Como o Sendi não tem classes estáveis para isso, `findChatBg()` detecta
  dinamicamente o maior painel (próprio elemento ou pseudo `::before`/`::after`) com
  `background-image`, marca com `data-cpc-bg="1"`. Cores automáticas delegadas ao service
  worker (ver abaixo); cacheadas por URL. As prefs `paletteHeader` e `paletteSide` (duas
  cores manuais no popup) sobrescrevem a extração: `paletteFromColors()` deriva
  header/botões/balão-enviado da primeira e lista/rodapé/balão-recebido da segunda. Modo
  manual ativo só quando `paletteHeader`+`paletteSide` definidas; usa cores EXATAS (sem
  derivar). **Papéis de cor** (divisão em `applyColors()`): `header` = topo+botões;
  `side` = painéis (navs, listas, rodapé, aside, relatórios); `bubbleOut`/`bubbleIn` = só
  balões enviado/recebido. **Inputs e cards de superfície NÃO usam `bubbleIn`** — recebem um
  tom derivado de `side` via `surfaceTone()` (clareia se `side` escuro, escurece se claro),
  pra destacar do painel sem copiar a cor do balão recebido. Balões têm cores próprias
  opcionais (`paletteBubbleOut`/`paletteBubbleIn`); se vazias herdam header/side.
  A pref `logoImage` troca a logo do header
  (`a.header-logo`): `applyLogo()` esconde o `<img>` original (`opacity:0`, preserva o
  tamanho) e pinta a URL como background da âncora — CSS puro, independe do papel de parede.
  O `applyColors()` injeta um stylesheet global, então a paleta vale em todas as telas: além
  do chat, tinge a tela de relatórios (`main.reports`, `aside.reports-aside`,
  `section.reports-content`, `.rep-topics`, `.rep-content-flex`, filtros `.session-filters`)
  com a cor `side`. Os cards de métrica (`.rep-topics-item`, incl. as variantes coloridas
  `--red/--blue/--green`) usam o tom de superfície (`surfaceTone(side)`). O painel de identificação do
  cliente (`.chat-aside` e variantes `--lead/--search/--history`) e o dropdown de finalização
  (`.subnav` / `.subnav-search` / `.subnav-list`) também vão para `side`.
- **`background.js`** — service worker. Único motivo de existir: buscar os bytes da imagem
  de fundo **ignorando o CORS da página** (precisa de `host_permissions: <all_urls>`, daí o
  aviso amplo de permissão) e extrair cores dominantes via `OffscreenCanvas`. Responde à
  mensagem `cpc-extract` com `{ header, side, bubbleIn, bubbleOut }`.
- **`ai.js`** — `window.CPC_AI`: Melhorar/Sugerir/Motivo são balões **só-ícone** no **dock**
  (`#cpc-dock`, lado direito), empilhados; o nome aparece em tooltip CSS (`[data-label]::after`)
  no hover. ai.js cria o dock e o expõe via `window.CPC_dock()` para o clientlink reusar.
  `gather()` lê as últimas N mensagens (`.msg` / `.msg-text`, `.msg--from-me` = atendente).
  `setComposer()` escreve no textarea React-controlado via setter nativo + evento `input`.
  Toda chamada de IA vai para o Worker (URL + token no popup). O popup de **Motivo**
  (`showReasonPop`) mostra cada motivo como uma linha clicável; a ação é ÚNICA e definida na
  pref `reasonAction` (`copy` = copiar texto | `finalize` = finalizar atendimento), escolhida
  no popup da extensão (botões segmentados, gated por `aiReason`). `finalizeWith()` automatiza
  o fluxo nativo (irreversível, pede `confirm()`): o botão "finalizar" do Sendi é um
  `div.button` (role generic, não `<button>`) com `<span>finalizar</span>` — `findFinalizeBtn()`
  acha pelo span e sobe pro `.button`. Depois espera o `.subnav-list` ficar VISÍVEL (a subnav
  abre via `display:none`→block, fica dentro do próprio botão), filtra digitando no
  `.subnav-search input` (setter nativo) e clica no item cujo texto bate com o motivo
  (`findReasonItem` varre várias tags e prefere a folha). Toasts diagnosticam o passo que falhou.
- **`clientlink.js`** — `window.CPC_ClientLink`: botão "Sistema do cliente" no mesmo dock
  (`window.CPC_dock()`), junto do "Motivo". `findLink()` lê a URL do painel
  `section.chat-aside--lead` (âncoras > campos `input/textarea` > texto); condição padrão
  Depende do React manter o painel lead montado com a conversa aberta.
- **`popup/`** — tela de configuração (HTML/JS puro) que grava em `cpc_prefs`.

### 2. Worker (`worker/src/worker.js`)
Cloudflare Worker, endpoints `POST /ai` (IA), `GET /models` (diagnóstico: lista os modelos que
cada chave enxerga, mesma autenticação — use quando um provedor aposenta um modelo e a chamada
volta `404 model_not_found`) e `GET /privacy` (política em HTML, sem autenticação).
O `/ai` autentica por `Bearer <SHARED_TOKEN>`, monta o prompt por `mode`
(`improve` | `suggest` | `reason`) em `buildPrompt()` e repassa ao provedor de IA.
O modo `reason` usa JSON mode (`responseMimeType` / `response_format`).

- **Fallback entre provedores** — cada provedor é uma classe com o mesmo método
  `generateContent(prompt)`: `GeminiProvider`, `GroqProvider`, `OpenRouterProvider`. A fila é
  montada em runtime **só com as secrets que existem**, nesta ordem, e o Worker cai para o
  próximo quando um lança erro (cota, 4xx/5xx). Nenhum funcionar → `502 Todos os provedores de
  IA falharam`. Modelos no topo de `worker.js`:

  | Ordem | Provedor | Modelo | Secret | Dashboard |
  |---|---|---|---|---|
  | 1 | Groq | `openai/gpt-oss-120b` | `GROQ_API_KEY` | https://console.groq.com/keys |
  | 2 | Google Gemini (AI Studio) | `gemini-2.5-flash-lite` | `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
  | 3 | OpenRouter | `minimax/minimax-m3:free` | `OPENROUTER_API_KEY` | https://openrouter.ai/workspaces/default/keys |

  Groq e OpenRouter falam o formato OpenAI (`/chat/completions`, `max_tokens`); o Gemini usa
  `generativelanguage.googleapis.com` (`maxOutputTokens`, `systemInstruction`).

- **A OpenRouter é roteador, não provedor final.** `minimax/minimax-m3:free` é servido pela
  **MiniMax** (empresa chinesa) — o conteúdo do atendimento sai do país nesse nível de reserva.
  Isso está declarado no `PRIVACY.md` e na `PRIVACY_HTML`; **trocar o modelo da OpenRouter exige
  atualizar os dois textos e redeployar** (a URL `/privacy` é a que as lojas exibem). Nas
  configurações da conta OpenRouter dá para bloquear provedores que treinam com os dados
  enviados (ajuste separado para modelos gratuitos e pagos) — vale conferir ao trocar de modelo.

- **`REASONS`** — lista FIXA de motivos de finalização (no topo de `worker.js`). A IA é
  forçada a escolher um item exato dessa lista; `validReason()` normaliza/valida o retorno.
  Para mudar os motivos: editar `REASONS` **e redeployar** o Worker.
- **`validReason()` é estrito de propósito** — com `reasonAction: 'finalize'` um casamento
  errado finaliza o atendimento com o motivo errado. `normReason()` normaliza (maiúsculas,
  sem acento, espaços colapsados, pontuação das bordas) e só são aceitos três casos:
  igual exato, **prefixo único** de um motivo (modelo truncou) ou texto que contém **um único**
  motivo inteiro (modelo grudou comentário). Retorno com menos de `MIN_PARCIAL` (12) caracteres
  que não bate exato é descartado — senão `"BUG"` ou `"DUVIDA"` casariam qualquer coisa.
  Ambiguidade (2+ motivos) → `null`, e a extensão avisa "Não consegui identificar o motivo".
- Secrets (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `SHARED_TOKEN`) ficam só no
  Worker, nunca na extensão. A extensão só conhece a URL do Worker + `SHARED_TOKEN` (prefs do popup).

## Convenções e armadilhas

- **Seletores quebram com mudanças do Sendi.** Centralize qualquer seletor novo em
  `selectors.js`. Strings de texto (`"Atender"`, `"transferida"`, `"finalizado"`,
  `"Aguardando atendimento"`) estão em `timer.js` e são sensíveis ao idioma/cópia do site.
- **`manifest.json` matches** = `https://*.sendi.example/*`. Se o domínio real do Sendi
  for outro, trocar aqui (ver README).
- Globais `window.CPC_*` substituem módulos — ao adicionar arquivo, registrá-lo na ordem
  certa do `content_scripts.js` no manifest.
- Todo estado persiste em `chrome.storage.local`; o popup e os content scripts se comunicam
  por `chrome.storage.onChanged` (não por mensagens diretas).

## Docs

Planejamento completo do produto: `docs/SDD_Sendi_Companion.md`. README em PT-BR cobre
instalação manual e checklist de "antes de usar".
