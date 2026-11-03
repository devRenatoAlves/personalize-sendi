# Política de Privacidade — Personalize Sendi

_Última atualização: 2026-08-25_

A extensão **Personalize Sendi** adiciona recursos ao site de atendimento Sendi
(cronômetro, temas e um assistente de IA). Esta política descreve quais dados a extensão acessa e o que
faz com eles.

## Dados que a extensão acessa

- **Mensagens do atendimento aberto** — ao usar os botões de IA (**Melhorar**,
  **Sugerir** e **Motivo de finalização**), o texto das últimas mensagens da conversa
  atual é lido da tela e enviado para processamento.
- **Preferências de configuração** — URL e token do servidor de IA, cores, imagens de
  tema e opções dos recursos. Ficam salvas **localmente** no seu navegador
  (`chrome.storage.local`) e podem ser exportadas/importadas por você em arquivo JSON.

## Para onde os dados vão

- As mensagens enviadas pela função de IA vão para um **servidor próprio
  (Cloudflare Worker)** controlado pelo operador da extensão, que apenas repassa o
  conteúdo a **um provedor de IA** para gerar a resposta. A resposta volta pela mesma rota.
- O Worker usa **três provedores em cadeia de reserva** (tenta o seguinte quando o
  anterior falha ou atinge o limite de uso). O conteúdo enviado pode, portanto, ser
  processado por qualquer um deles:
  1. **Groq** — modelo `openai/gpt-oss-120b`
  2. **Google Gemini** (Google AI Studio) — modelo `gemini-2.5-flash-lite`
  3. **OpenRouter** — modelo `minimax/minimax-m3:free`. A OpenRouter é um **roteador**:
     ela repassa a requisição ao provedor que hospeda o modelo — neste caso a **MiniMax**,
     empresa sediada na China. Ou seja, no terceiro nível de reserva o conteúdo é
     processado **fora do Brasil**, por uma empresa fora da União Europeia e dos EUA.
- O envio à IA **só acontece quando você clica** em um dos botões de IA. Sem clique,
  nenhuma mensagem sai do navegador.

## Armazenamento

- As mensagens **não são armazenadas** pela extensão nem pelo Worker; são usadas apenas
  para gerar a resposta da requisição e descartadas.
- O uso de cada provedor segue os termos dele:
  - Groq — https://groq.com/privacy-policy/
  - Google Gemini — https://ai.google.dev/gemini-api/terms
  - OpenRouter — https://openrouter.ai/privacy
  - MiniMax (modelo servido via OpenRouter) — https://platform.minimax.io/protocol/privacy-policy
- A OpenRouter permite, nas configurações da conta, **bloquear o roteamento para provedores
  que treinam com os dados enviados**, com ajuste separado para modelos gratuitos e pagos.
  Quem opera o Worker é responsável por manter essa configuração como deseja.
- As preferências ficam **apenas no seu navegador**. A extensão não as envia a lugar
  nenhum (exceto quando você mesmo exporta o arquivo de backup).

## Permissões

- `storage` — salvar suas preferências localmente.
- `<all_urls>` (host permission) — necessária para o componente de background baixar a
  **imagem de fundo** escolhida por você (de qualquer URL) e extrair as cores do tema,
  contornando restrições de CORS da página. Não é usada para monitorar navegação.

## Sem rastreamento

A extensão **não** coleta analytics, não rastreia navegação, não usa cookies de
terceiros e não vende dados.

## Contato

Dúvidas sobre privacidade: personalize-sendi@personalizenato.com
