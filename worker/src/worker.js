// Personalize Pro — Worker proxy de IA com fallback entre 3 provedores:
//   1) Groq (gpt-oss)  2) Google Gemini (AI Studio)  3) OpenRouter (free)
// Mantém as chaves fora da extensão. Auth por token compartilhado (SHARED_TOKEN).
// Dashboards das chaves:
//   Gemini     https://aistudio.google.com/apikey
//   Groq       https://console.groq.com/keys
//   OpenRouter https://openrouter.ai/workspaces/default/keys
// Configuração dos modelos
const GEMINI_MODEL = 'gemini-2.5-flash-lite'; // cota do free tier é POR MODELO; o -lite tem limite maior
const GROQ_MODEL = 'openai/gpt-oss-120b'; // Groq aposentou os Llama de texto (404 model_not_found)
const OPENROUTER_MODEL = 'minimax/minimax-m3:free'; // Gratuito, suporta response_format; upstream NÃO-Google (evita cair na mesma cota do Gemini)

class GeminiProvider {
  constructor(apiKey) { this.apiKey = apiKey; }
  async generateContent(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(this.apiKey.trim())}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
        generationConfig: {
          temperature: prompt.temperature,
          maxOutputTokens: prompt.maxTokens || 160,
          thinkingConfig: { thinkingBudget: 0 },
          ...(prompt.jsonMode ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    });
    if (!res.ok) throw new Error(`Gemini Error: ${res.status} - ${await res.text()}`);
    const data = await res.json();
    if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new Error('Gemini: resposta truncada (MAX_TOKENS)');
    return (data.candidates?.[0]?.content?.parts?.map((x) => x.text || '').join('') || '').trim();
  }
}

class GroqProvider {
  constructor(apiKey) { this.apiKey = apiKey; }
  async generateContent(prompt) {
    const url = `https://api.groq.com/openai/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
          'content-type': 'application/json',
          'authorization': `Bearer ${this.apiKey.trim()}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
           { role: 'system', content: prompt.system },
           { role: 'user', content: prompt.user }
        ],
        temperature: prompt.temperature,
        // Groq uses max_tokens instead of maxOutputTokens
        max_tokens: prompt.maxTokens || 160,
        // gpt-oss é modelo de raciocínio: os tokens de "pensamento" contam no max_tokens.
        // Esforço baixo evita gastar o orçamento pensando e entregar texto vazio/cortado.
        reasoning_effort: 'low',
        ...(prompt.jsonMode ? { response_format: { type: "json_object" } } : {})
      }),
    });
    if (!res.ok) throw new Error(`Groq Error: ${res.status} - ${await res.text()}`);
    const data = await res.json();
    if (data.choices?.[0]?.finish_reason === 'length') throw new Error('Groq: resposta truncada (max_tokens)');
    return (data.choices?.[0]?.message?.content || '').trim();
  }
}

class OpenRouterProvider {
  constructor(apiKey) { this.apiKey = apiKey; }
  async generateContent(prompt) {
    const url = `https://openrouter.ai/api/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 
          'content-type': 'application/json',
          'authorization': `Bearer ${this.apiKey.trim()}`
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
           { role: 'system', content: prompt.system },
           { role: 'user', content: prompt.user }
        ],
        temperature: prompt.temperature,
        // OpenRouter também segue o padrão da OpenAI
        max_tokens: prompt.maxTokens || 160,
        ...(prompt.jsonMode ? { response_format: { type: "json_object" } } : {})
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter Error: ${res.status} - ${await res.text()}`);
    const data = await res.json();
    if (data.choices?.[0]?.finish_reason === 'length') throw new Error('OpenRouter: resposta truncada (max_tokens)');
    return (data.choices?.[0]?.message?.content || '').trim();
  }
}
// Motivos de finalização. A lista real é privada e vem da secret REASONS (um motivo por
// linha ou JSON array) — ver README. Abaixo só um exemplo genérico, usado se a secret não existir.
const DEFAULT_REASONS = [
  'DÚVIDA - ORIENTAÇÃO AO CLIENTE',
  'PROBLEMA TÉCNICO - RESOLVIDO',
  'PROBLEMA TÉCNICO - ENCAMINHADO',
  'SOLICITAÇÃO - CONFIGURAÇÃO',
  'SEM RETORNO DO CLIENTE',
];
let REASONS = DEFAULT_REASONS;
let REASON_SET = new Map();
function loadReasons(env) {
  const raw = (env && env.REASONS ? String(env.REASONS) : '').trim();
  let list = DEFAULT_REASONS;
  if (raw) {
    try { const j = JSON.parse(raw); if (Array.isArray(j)) list = j.map(String); }
    catch { list = raw.split('\n'); }
    list = list.map((x) => x.trim()).filter(Boolean);
    if (!list.length) list = DEFAULT_REASONS;
  }
  REASONS = list;
  REASON_SET = new Map(REASONS.map((r) => [normReason(r), r]));
}
// Normaliza para comparar: maiúsculas, sem acento, espaços colapsados, sem pontuação
// nas bordas (o modelo às vezes devolve com aspas, ponto final ou acento faltando).
function normReason(x) {
  return String(x == null ? '' : x)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'.,;:-]+|[\s"'.,;:-]+$/g, '')
    .trim();
}


// Abaixo disso o trecho é genérico demais ("BUG", "DUVIDA", "FISCAL") e casaria
// qualquer motivo da lista. Retorno curto que não bate exato é descartado.
const MIN_PARCIAL = 12;

// Valida/normaliza um motivo retornado pela IA contra a lista fixa.
// Só aceita: (1) igual exato, (2) prefixo ÚNICO de um motivo (modelo truncou) ou
// (3) texto que contém UM único motivo inteiro (modelo grudou comentário).
// Ambíguo (casa 2+ motivos) → null: melhor não sugerir do que finalizar com o motivo errado.
function validReason(x) {
  const u = normReason(x);
  if (!u) return null;

  const exact = REASON_SET.get(u);
  if (exact) return exact;
  if (u.length < MIN_PARCIAL) return null;

  let hits = REASONS.filter((r) => normReason(r).startsWith(u));
  if (!hits.length) hits = REASONS.filter((r) => u.includes(normReason(r)));
  return hits.length === 1 ? hits[0] : null;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });

export default {
  async fetch(req, env) {
    loadReasons(env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const path = new URL(req.url).pathname;
    if (path === '/privacy') return new Response(PRIVACY_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (path !== '/ai' && path !== '/models') return json({ error: 'not found' }, 404);
    if (path === '/ai' && req.method !== 'POST') return json({ error: 'POST only' }, 405);

    const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
    if (!env.SHARED_TOKEN || token !== env.SHARED_TOKEN) return json({ error: 'unauthorized' }, 401);

    // GET /models — diagnóstico: lista os modelos que as chaves do Worker enxergam,
    // sem expor as chaves. Serve para descobrir o nome certo quando um provedor
    // aposenta um modelo (o erro típico é 404 model_not_found).
    if (path === '/models') {
      const out = {};
      if (env.GROQ_API_KEY) {
        try {
          const r = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { authorization: `Bearer ${env.GROQ_API_KEY.trim()}` },
          });
          const d = await r.json();
          out.groq = r.ok ? (d.data || []).map((m) => m.id).sort() : d;
        } catch (e) { out.groq = String(e); }
      }
      if (env.GEMINI_API_KEY) {
        try {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(env.GEMINI_API_KEY.trim())}`
          );
          const d = await r.json();
          out.gemini = r.ok ? (d.models || []).map((m) => m.name.replace('models/', '')).sort() : d;
        } catch (e) { out.gemini = String(e); }
      }
      return json(out);
    }

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

    const prompt = buildPrompt(body);
    if (!prompt) return json({ error: 'bad mode' }, 400);

    // Lista de provedores por ordem de prioridade
    // Ordem: Groq primeiro — o free tier do Gemini é de 20 req/dia por modelo e
    // esgota em minutos de uso real, virando fallback em vez de principal.
    const providers = [];
    if (env.GROQ_API_KEY) providers.push(new GroqProvider(env.GROQ_API_KEY));
    if (env.GEMINI_API_KEY) providers.push(new GeminiProvider(env.GEMINI_API_KEY));
    if (env.OPENROUTER_API_KEY) providers.push(new OpenRouterProvider(env.OPENROUTER_API_KEY));

    if (providers.length === 0) return json({ error: 'Nenhuma chave de API configurada' }, 500);

    let content = null;
    const errors = [];

    for (const provider of providers) {
      const name = provider.constructor.name;
      try {
        const out = await provider.generateContent(prompt);
        // Resposta 200 mas vazia (ex: Gemini cortando em MAX_TOKENS) NÃO conta como
        // sucesso — sem isso o loop dava break e o Worker respondia "todos falharam"
        // sem nunca ter tentado os outros provedores.
        if (!out) throw new Error('resposta vazia');
        content = out;
        break; // Sucesso! Sai do loop de tentativa
      } catch (e) {
        // Se der erro (ex: limite atingido), guarda o erro e tenta o próximo provedor
        console.error('Provider falhou:', name, String(e));
        errors.push(`${name}: ${String((e && e.message) || e)}`);
      }
    }

    if (!content) {
      return json({ error: 'Todos os provedores de IA falharam', detail: errors.join(' | ') }, 502);
    }

    try {
      if (body.mode === 'reason') {
        const parsed = parseJsonLoose(content);
        const reason = validReason(parsed.reason);
        const alternatives = (parsed.alternatives || [])
          .map(validReason)
          .filter((r) => r && r !== reason)
          .slice(0, 2);
        return json({ reason, alternatives, justificativa: parsed.justificativa || '' });
      }
      return json({ result: content });
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  },
};

// Extrai o objeto JSON de uma resposta suja: cercas ```json, blocos <think>…</think>
// ou comentários grudados antes/depois. Retorna {} se não achar nada parseável.
function parseJsonLoose(text) {
  const raw = String(text || '');
  try { return JSON.parse(raw); } catch {}
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '');
  try { return JSON.parse(cleaned.trim()); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
  }
  return {};
}

// Monta system+user por modo. conversation = [{from:'me'|'client', text}].
function buildPrompt(body) {
  const { mode, draft, conversation } = body;
  const convText = (conversation || [])
    .map((m) => `${m.from === 'me' ? 'Atendente' : 'Cliente'}: ${m.text}`)
    .join('\n');

  if (mode === 'improve') {
    return {
      temperature: 0.4,
      // Orçamento proporcional ao rascunho (texto revisado ≈ mesmo tamanho) + folga
      // para modelos de raciocínio. Antes era fixo em 400 e cortava textos de 4+ linhas.
      maxTokens: Math.min(4000, Math.ceil(String(draft || '').length / 2) + 1200),
      system:
        'Você é um revisor de português do Brasil para mensagens de um atendente de suporte ao cliente. ' +
        'Sua tarefa é APRIMORAR o texto do atendente, mantendo-o na medida certa:\n' +
        '- Corrija ortografia, acentuação, pontuação e erros de concordância.\n' +
        '- Melhore a escolha de palavras e a fluidez, deixando o texto bem escrito.\n' +
        '- Garanta um tom EDUCADO e CORDIAL, sem soar robótico nem exagerado.\n' +
        'REGRAS: preserve o sentido, as informações e o tamanho aproximado do original. ' +
        'NÃO adicione informações, saudações ou despedidas que não existam no rascunho, e ' +
        'NÃO remova conteúdo relevante. Mantenha a mesma quantidade de frases e parágrafos sempre que possível. ' +
        'Não invente dados. Responda APENAS com o texto revisado, sem aspas, sem comentários e sem explicações.',
      user: `Conversa até aqui:\n${convText}\n\nRascunho do atendente:\n${draft}`,
    };
  }
  if (mode === 'suggest') {
    return {
      temperature: 0.5,
      maxTokens: 800, // folga para raciocínio; a instrução do prompt já limita a 1-2 frases
      system:
        'Você sugere a próxima resposta de um atendente de suporte ao cliente em português do Brasil. ' +
        'Escreva de forma EDUCADA, CORDIAL e bem redigida, com português correto (ortografia e concordância). ' +
        'Seja objetivo: 1 a 2 frases, direto ao ponto, sem rodeios nem saudações longas ou empatia exagerada. ' +
        'Não invente dados que não estão na conversa. ' +
        'Responda APENAS com a mensagem sugerida, sem aspas nem comentários.',
      user: `Conversa:\n${convText}\n\nSugira a próxima mensagem do atendente.`,
    };
  }
  if (mode === 'reason') {
    const lista = REASONS.map((r, i) => `${i + 1}. ${r}`).join('\n');
    return {
      temperature: 0,
      jsonMode: true,
      // Folgado de propósito: modelos de raciocínio (minimax-m3 etc.) gastam tokens
      // "pensando" antes de emitir o JSON — com 220 o JSON saía truncado.
      maxTokens: 900,
      system:
        'Você classifica um atendimento de suporte escolhendo o MOTIVO DE FINALIZAÇÃO mais adequado ' +
        'de uma LISTA FIXA. Regras OBRIGATÓRIAS: os campos "reason" e "alternatives" devem ser EXATAMENTE ' +
        'iguais a itens da lista (copie ao pé da letra, mesma grafia e acentos). Escolha o motivo mais ' +
        'específico que represente o que o atendimento tratou/resolveu. ' +
        'Responda em JSON: {"reason":"<motivo>","alternatives":["<motivo>","<motivo>"],"justificativa":"<frase curta>"}.',
      user: `LISTA DE MOTIVOS:\n${lista}\n\nCONVERSA:\n${convText}\n\nEscolha o motivo de finalização.`,
    };
  }
  return null;
}

// Política de privacidade servida em GET /privacy (URL exigida pelas lojas).
const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Política de Privacidade — Personalize Pro</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#1e293b}h1{font-size:24px}h2{font-size:18px;margin-top:28px}code{background:#f1f5f9;padding:1px 5px;border-radius:4px}</style>
</head><body>
<h1>Política de Privacidade — Personalize Pro</h1>
<p><em>Última atualização: 2026-08-25</em></p>
<p>A extensão <strong>Personalize Sendi</strong> adiciona recursos ao site de atendimento Sendi (cronômetro, temas e assistente de IA). Esta política descreve quais dados a extensão acessa e o que faz com eles.</p>
<h2>Dados que a extensão acessa</h2>
<ul>
<li><strong>Mensagens do atendimento aberto</strong> — ao usar os botões de IA (Melhorar, Sugerir e Motivo de finalização), o texto das últimas mensagens da conversa atual é lido da tela e enviado para processamento.</li>
<li><strong>Preferências de configuração</strong> — URL e token do servidor de IA, cores, imagens de tema e opções dos recursos. Ficam salvas localmente no navegador (<code>chrome.storage.local</code>) e podem ser exportadas/importadas pelo usuário em arquivo JSON.</li>
</ul>
<h2>Para onde os dados vão</h2>
<p>As mensagens enviadas pela função de IA vão para um servidor próprio (Cloudflare Worker) controlado pelo operador da extensão, que apenas repassa o conteúdo a um provedor de IA para gerar a resposta. A resposta volta pela mesma rota. O envio à IA só acontece quando o usuário clica em um dos botões de IA.</p>
<p>O Worker usa três provedores em cadeia de reserva (tenta o seguinte quando o anterior falha ou atinge o limite de uso), então o conteúdo pode ser processado por qualquer um deles:</p>
<ul>
<li><strong>Groq</strong> — modelo <code>openai/gpt-oss-120b</code></li>
<li><strong>Google Gemini</strong> (Google AI Studio) — modelo <code>gemini-2.5-flash-lite</code></li>
<li><strong>OpenRouter</strong> — modelo <code>minimax/minimax-m3:free</code>. A OpenRouter é um roteador: repassa a requisição ao provedor que hospeda o modelo — neste caso a <strong>MiniMax</strong>, empresa sediada na China. Nesse terceiro nível de reserva o conteúdo é processado fora do Brasil.</li>
</ul>
<h2>Armazenamento</h2>
<p>As mensagens não são armazenadas pela extensão nem pelo Worker; são usadas apenas para gerar a resposta e descartadas. O uso de cada provedor segue os termos dele: <a href="https://groq.com/privacy-policy/">Groq</a>, <a href="https://ai.google.dev/gemini-api/terms">Google Gemini</a>, <a href="https://openrouter.ai/privacy">OpenRouter</a> e <a href="https://platform.minimax.io/protocol/privacy-policy">MiniMax</a> (modelo servido via OpenRouter). As preferências ficam apenas no navegador do usuário.</p>
<h2>Permissões</h2>
<ul>
<li><code>storage</code> — salvar as preferências localmente.</li>
<li><code>&lt;all_urls&gt;</code> — necessária para o componente de background baixar a imagem de fundo escolhida pelo usuário (de qualquer URL) e extrair as cores do tema, contornando o CORS da página. Não é usada para monitorar navegação.</li>
</ul>
<h2>Sem rastreamento</h2>
<p>A extensão não coleta analytics, não rastreia navegação, não usa cookies de terceiros e não vende dados.</p>
<h2>Contato</h2>
<p>Dúvidas sobre privacidade: personalize-pro@personalizenato.com</p>
</body></html>`;
