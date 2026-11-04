# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Personalize Sendi — extensão de navegador (Manifest V3, Chrome/Edge/Firefox) que injeta recursos
no SaaS de atendimento **Sendi**: modo clean para telas pequenas, tema
visual (papel de parede + cores extraídas da imagem), assistente de IA (Melhorar/Sugerir
resposta, motivo de finalização) e atalho para o sistema do cliente. Há um **Cloudflare
Worker** que faz proxy de IA com **fallback entre 3 provedores** (Groq → Gemini →
OpenRouter), mantendo as chaves fora da extensão.

**Status**: adaptada ao Sendi (`*.sendi.chat`). O cronômetro foi removido porque o Sendi tem um nativo; o tema agora sobrescreve variáveis CSS (shadcn) em vez de classes. Detalhes de cada módulo abaixo ainda descrevem a origem ChatPro em parte; `extension/src/selectors.js` e o README são a fonte atual.

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

`selectors.js` → `storage.js` → `theme.js` → `clean.js` → `ai.js` → `clientlink.js` → `content.js`

- **`selectors.js`** — todos os seletores DOM do Sendi. O Sendi é Vue + Tailwind/shadcn (classes
  utilitárias instáveis), então os seletores usam atributos estáveis: `data-slot`,
  `data-message-id`, `data-conversa-aberta`, `aria-label`. Se algo quebrar, comece aqui.
- **`storage.js`** — wrapper de `chrome.storage.local`; `getPrefs()` define os defaults
  (toda pref nova precisa de default aqui).
- **`theme.js`** — o Sendi usa variáveis CSS (`--background`, `--primary`, `--sidebar-background`…).
  `applyColors()` sobrescreve essas variáveis em `:root`/`.dark` com `!important`, escolhendo
  texto claro/escuro pela luminância da cor `side`. Papéis: `header`→`--primary`; `side`→fundos;
  tom de superfície derivado→`--muted/--input/--accent`; a classe `.dark` do `<html>` é ligada/desligada conforme a luminância (restaurada ao desligar o tema); a paleta manual vale sem imagem de fundo; `bubbleOut/bubbleIn`→balões
  (`[data-message-id].justify-end|start > div[class*="rounded-xl"]`). Papel de parede na área
  de mensagens (`chatBg`); logo em `headerLogo`. Cores automáticas vêm do service worker.
- **Modo vidro** (`applyGlass()` em `theme.js`, prefs `glassMode/glassOpacity/glassBlur`): papel de parede em `[class~="group/sidebar-wrapper"]` (fundo do app todo), `main` transparente, e `color-mix(var(--background) N%, transparent)` + `backdrop-filter: blur()` nos painéis (sidebar, `main aside`, cabeçalhos, composer, balões, popovers). Quando ligado, o papel de parede NÃO vai na área de mensagens (`applyChatBg`).
- **`clean.js`** — modo clean (`html.cpc-clean`, regras em `styles.css`): esconde a barra
  lateral e o cabeçalho do app, deixa só a lista de atendimentos (340px) e a conversa.
  Botão flutuante `#cpc-clean-toggle` + switch no popup. Ao esconder a `nav` de filtros é
  preciso forçar `grid-template-columns` do aside, senão a lista cai numa coluna de 16px.
- **`background.js`** — service worker: baixa a imagem de fundo ignorando CORS e extrai cores.
- **`ai.js`** — Melhorar/Sugerir/Motivo no dock (`#cpc-dock`), que vive na barra de botões do composer (`composerBar`) e cai para um bloco flutuante se a barra não existir; `dock()` reposiciona a cada refresh porque o Vue recria a barra. `gather()` lê `[data-message-id]`
  (`justify-end` = equipe, `justify-start` = cliente). Finalizar abre o popover nativo
  (`[data-slot=popover-content]` com `command-input` e `command-item`), filtra digitando e clica
  no item — **irreversível**, pede `confirm()`.
- **`avatar.js`** — visualizador da foto do contato (clique no `headerAvatar`, captura antes do Sendi abrir o painel). A origem é 96×96 (`/chat/conversations/{id}/avatar` ignora parâmetros de tamanho); `enhance()` faz Lanczos-3 6× + máscara de nitidez no canvas.
- **`clientlink.js`** — botão 🔗: nome do contato `fulano - estabelecimento` →
  `https://<estabelecimento>.<clientLinkDomain>`. Fora do padrão = sem botão.
- **Cronômetro**: não existe; o Sendi mostra "Em atendimento há…" nos cards.
- **`popup/`** — configuração (HTML/JS puro) gravada em `cpc_prefs`.

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

- **`REASONS`** — motivos de finalização vindos da secret `REASONS` (um por linha ou JSON); sem ela vale `DEFAULT_REASONS`. A IA só pode escolher um item exato da lista.
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

- **Seletores quebram com mudanças do Sendi.** Centralize em `selectors.js`.
- **`manifest.json` matches** = `https://*.sendi.chat/*`. Se o domínio real do Sendi
  for outro, trocar aqui (ver README).
- Globais `window.CPC_*` substituem módulos — ao adicionar arquivo, registrá-lo na ordem
  certa do `content_scripts.js` no manifest.
- Todo estado persiste em `chrome.storage.local`; o popup e os content scripts se comunicam
  por `chrome.storage.onChanged` (não por mensagens diretas).

## Docs

README em PT-BR cobre
instalação manual e checklist de "antes de usar".
