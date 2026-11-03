# Personalize Sendi

Extensão de navegador (Manifest V3) que adiciona recursos ao site de atendimento Sendi:
cronômetro por atendimento com cores de SLA, tema visual (papel de parede + paleta de cores),
assistente de IA (Melhorar / Sugerir / Motivo de finalização) e atalho para o sistema do cliente.

Planejamento original: [docs/SDD_Sendi_Companion.md](docs/SDD_Sendi_Companion.md).

## Status

**Adaptada ao Sendi** (`*.sendi.chat`). Seletores mapeados em `extension/src/selectors.js`
com base em atributos estáveis (`data-slot`, `data-message-id`, `aria-label`).

- **Tema**: o Sendi usa variáveis CSS (shadcn). A paleta sobrescreve `--background`, `--primary`,
  `--sidebar-background` etc., e o texto troca entre claro/escuro conforme a cor escolhida.
  Papel de parede na área de mensagens, logo trocável, cores dos balões.
- **IA**: Melhorar / Sugerir / Motivo de finalização (copiar ou finalizar pelo popover nativo).
- **Cronômetro**: removido. O Sendi já mostra "Em atendimento há…" com cor em cada card.
- **Sistema do cliente**: o botão 🔗 aparece quando o nome do contato é `fulano - estabelecimento` (último trecho = uma palavra `a-z0-9-`) e abre `https://<estabelecimento>.<domínio>`. O domínio é definido no popup (campo "Domínio do sistema"). Nome fora do padrão = sem botão.
- **Não testado ainda**: o clique que finaliza de verdade (é irreversível; teste num atendimento seu).

## Estrutura

```
extension/
  manifest.json    # MV3 dual (Chrome + Firefox)
  icons/           # 16/32/48/128
  popup/
    popup.html
    popup.js       # tela de configuração (grava em chrome.storage.local)
  src/
    selectors.js   # seletores DOM centralizados (atualizar aqui se o Sendi mudar)
    storage.js     # chrome.storage: timers + preferências
    theme.js       # papel de parede + paleta de cores aplicada por stylesheet
    ai.js          # assistente IA: Melhorar, Sugerir, Motivo (fala com o Worker)
    clientlink.js  # botão "Sistema do cliente" (lê a URL do painel do lead)
    content.js     # entrada: MutationObserver + init
    background.js  # service worker: baixa a imagem e extrai cores (ignora CORS)
    styles.css     # estilo do timer, do dock e do tema
worker/
  wrangler.toml
  src/worker.js    # Cloudflare Worker: proxy de IA com fallback entre 3 provedores
docs/
  SDD_Sendi_Companion.md
```

## Como instalar (modo desenvolvedor)

1. Chrome/Edge → `chrome://extensions`.
2. Ativar **Modo do desenvolvedor**.
3. **Carregar sem compactação** → selecionar a pasta `extension/`.
4. Abrir o Sendi. Cronômetro aparece nos cards; configurar no ícone da extensão.

No Firefox: `about:debugging` → **Este Firefox** → **Carregar extensão temporária** → `extension/manifest.json`.

## IA — provedores e chaves

Nenhuma chave de IA fica na extensão. Tudo passa pelo Cloudflare Worker (`worker/`), endpoint
único `POST /ai`, autenticado por `Bearer <SHARED_TOKEN>`. O Worker tenta os provedores **em ordem**
e cai para o próximo quando um falha (cota estourada, erro HTTP, indisponibilidade):

| Ordem | Provedor | Modelo | Secret | Dashboard da chave |
|-------|----------|--------|--------|--------------------|
| 1 | Groq | `openai/gpt-oss-120b` | `GROQ_API_KEY` | https://console.groq.com/keys |
| 2 | Google Gemini (AI Studio) | `gemini-2.5-flash-lite` | `GEMINI_API_KEY` | https://aistudio.google.com/apikey |
| 3 | OpenRouter | `minimax/minimax-m3:free` | `OPENROUTER_API_KEY` | https://openrouter.ai/workspaces/default/keys |

O Groq vem primeiro porque o free tier do Gemini é de poucas requisições por dia **por modelo** e
esgota rápido em uso real — ele fica melhor como reserva. ⚠️ A **OpenRouter é um roteador**: o
modelo `minimax/minimax-m3:free` é servido pela **MiniMax** (empresa chinesa), então nesse nível
de reserva o conteúdo do atendimento sai do país — está declarado no `PRIVACY.md`. Ao trocar o
modelo da OpenRouter, atualize as duas políticas e confira, nas configurações da conta, o
bloqueio de provedores que treinam com os dados enviados. Além de `POST /ai`, o Worker expõe
`GET /models` (mesma autenticação): lista os modelos que cada chave enxerga, útil quando um
provedor aposenta um modelo e a chamada volta `404 model_not_found`.

Só entram na fila os provedores cuja secret existe. Se todos falharem, o Worker responde `502`.
Os modelos ficam no topo de `worker/src/worker.js` (`GEMINI_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL`).

### Deploy do Worker

```bash
cd worker
npx wrangler dev          # roda local
npx wrangler deploy       # publica

npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put SHARED_TOKEN      # token compartilhado extensão↔Worker (você inventa)
```

Depois, no popup da extensão: preencher **URL do Worker** + **token**.

## ⚠️ Antes de usar — confirmar

- **Domínio do Sendi:** `manifest.json` usa `https://*.sendi.chat/*`.
  Trocar para o domínio real onde o site roda (ver barra de endereço).
- **Gatilho do timer (início):** clique em **"Atender"** — pickup real, carimba `Date.now()` no
  segundo exato. Enquanto `Aguardando atendimento`, NÃO conta. Persistido por UUID; trocar de aba
  ou recarregar não reinicia.
- **Encerramento:** ao abrir uma conversa finalizada (texto `Atendimento finalizado por ...`),
  o timer daquele card é removido. Limpeza automática de resíduos após 24h.
- **SLA:** verde até `slaYellow` min, amarelo até `slaRed` min, vermelho depois (configurável no popup).
- **Tema:** substitui o fundo de rabiscos do chat pela imagem (URL direta). Slider
  "Escurecer fundo" aplica um overlay preto regulável (0–90%) para legibilidade.
- **Cores automáticas:** o service worker busca a imagem e extrai as cores dominantes. Requer
  `host_permissions` amplo (`<all_urls>`) para ler imagens de qualquer host — daí o aviso de
  permissão na instalação. Desligável no popup; as cores também podem ser definidas à mão
  (header, lateral e balões).
- **Motivo de finalização (IA):** botão "🏁 Motivo" lê o atendimento e recomenda o motivo
  da lista fixa (em `worker/src/worker.js` → `REASONS`) + alternativas + justificativa.
  A ação do clique é única e escolhida no popup (`reasonAction`): **copiar** o texto ou
  **finalizar** o atendimento pelo fluxo nativo do Sendi (irreversível, pede confirmação).
  Atualizar a lista = editar `REASONS` + redeploy do Worker.
- **Assistente IA:** "Melhorar" reescreve o rascunho; "Sugerir" propõe a próxima resposta.
  Ambos enviam as últimas mensagens da conversa ao Worker.
- **Sistema do cliente:** botão no dock que abre a URL encontrada no painel do lead
- **Posição do timer:** injetado no `<aside>` do card. Ajustar `cardSlot` em `selectors.js`.
- **Backup das configurações:** o botão "Exportar" do popup gera um JSON com **todas** as prefs,
  incluindo o `aiToken` (o token do Worker). Trate esse arquivo como segredo — não versione nem
  compartilhe. O `.gitignore` já ignora `personalize-sendi-config-*.json`.
- **Nada de segredo no repositório:** as chaves de IA ficam só como secrets do Worker. O
  `.gitignore` bloqueia `.env`, `.dev.vars`, `worker/.wrangler/` (cache com o ID da conta
  Cloudflare) e os `.zip` gerados para as lojas.

## Publicação

Ver o passo a passo (bump de versão + script de zip com `/` nos caminhos) em
[CLAUDE.md](CLAUDE.md). Política de privacidade: [PRIVACY.md](PRIVACY.md) (também servida pelo
Worker em `GET /privacy`, URL exigida pelas lojas).

## Configurando os motivos de finalização

A lista de motivos é privada: não fica no repositório. Defina a secret `REASONS` no Worker
(um motivo por linha ou um JSON array). Sem ela, vale uma lista genérica de exemplo.

```
cd worker
npx wrangler secret put REASONS
```
