// Assistente de IA: botão "Melhorar", "Sugerir" e "Motivo".
// Fala com o Worker (proxy de IA: Gemini → Groq → OpenRouter). Config vem das prefs (popup).
window.CPC_AI = (function () {
  const S = window.CPC_SELECTORS;
  let cfg = { url: '', token: '', improve: true, suggest: true, reason: true, reasonAction: 'copy' };
  let busy = false;

  async function reload() {
    const p = await window.CPC_store.getPrefs();
    cfg = {
      url: p.aiUrl || '', token: p.aiToken || '',
      improve: p.aiImprove !== false, suggest: p.aiSuggest !== false,
      reason: p.aiReason !== false,
      reasonAction: p.reasonAction === 'finalize' ? 'finalize' : 'copy',
    };
    ensureDockButtons();
  }

  const composer = () => document.querySelector(S.composer);

  // Escreve no textarea React-controlado.
  function setComposer(text) {
    const el = composer();
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }

  // Lê as últimas mensagens da conversa aberta. Enviadas (justify-end) = equipe/flow;
  // recebidas (justify-start) = cliente. O horário e o "entregue" vivem dentro do <p>
  // em spans, então a leitura é feita num clone sem eles.
  function gather(max = 25) {
    return [...document.querySelectorAll(S.message)]
      .map((m) => {
        const p = m.querySelector(S.messageText);
        if (!p) return null;
        const clone = p.cloneNode(true);
        clone.querySelectorAll('span.tabular-nums, .sr-only').forEach((n) => n.remove());
        return {
          from: m.classList.contains('justify-end') ? 'me' : 'client',
          text: (clone.textContent || '').trim(),
        };
      })
      .filter((m) => m && m.text)
      .slice(-max);
  }

  async function call(mode, payload) {
    if (!cfg.url || !cfg.token) { toast('Configure URL e token da IA no popup.'); return null; }
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.token },
        body: JSON.stringify({ mode, ...payload }),
      });
      const data = await res.json();
      if (data.error) {
        // detail traz o erro real de cada provedor — sem ele o toast só dizia
        // "Todos os provedores de IA falharam" e não dava pra diagnosticar.
        console.error('[CPC] IA erro', res.status, data);
        toast('IA: ' + data.error + (data.detail ? ' — ' + data.detail : ''));
        return null;
      }
      return data;
    } catch (e) { toast('IA falhou: ' + e); return null; }
  }

  // --- UI: dock flutuante + popup de resultado + toast ---
  // Dock compartilhado (direita): todas as ações por conversa, balões só-ícone empilhados.
  // clientlink.js reusa via window.CPC_dock(). Criado sob demanda.
  // O dock mora na barra de botões da resposta (ao lado de "Agendar"); sem a barra
  // (ex.: nenhuma conversa aberta) cai para um bloco flutuante. Reposicionado a cada refresh
  // porque o Vue recria a barra ao trocar de conversa.
  function dock() {
    let d = document.getElementById('cpc-dock');
    if (!d) {
      d = document.createElement('div');
      d.id = 'cpc-dock';
    }
    const bar = document.querySelector(S.composerBar);
    if (bar) {
      if (d.parentElement !== bar) bar.insertBefore(d, bar.lastElementChild);
      d.classList.add('cpc-inline');
    } else {
      if (d.parentElement !== document.body) document.body.appendChild(d);
      d.classList.remove('cpc-inline');
    }
    return d;
  }
  window.CPC_dock = dock;

  // Botões da IA no dock (Melhorar/Sugerir/Motivo). Só-ícone; nome aparece no hover.
  // Ordem no dock (cima→baixo): Motivo(1), Link(2, clientlink.js), Sugerir(3), Melhorar(4).
  const DOCK_BTNS = [
    { id: 'cpc-ai-reason', icon: 'clipboard-list', label: 'Motivo', order: 1, on: () => cfg.reason, click: onReason },
    { id: 'cpc-ai-suggest', icon: 'lightbulb', label: 'Sugerir', order: 3, on: () => cfg.suggest, click: onSuggest },
    { id: 'cpc-ai-improve', icon: 'wand-sparkles', label: 'Melhorar', order: 4, on: () => cfg.improve, click: onImprove },
  ];

  function ensureDockButtons() {
    const open = !!composer();
    if (open) dock();
    DOCK_BTNS.forEach((b) => {
      let el = document.getElementById(b.id);
      if (!(open && b.on())) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('button');
        el.id = b.id;
        el.type = 'button';
        el.className = 'cpc-dock-btn';
        el.style.order = String(b.order);
        el.title = b.label;
        el.innerHTML = window.CPC_icon(b.icon, 17) + `<span class="cpc-dock-label">${b.label}</span>`;
        el.addEventListener('click', b.click);
        dock().appendChild(el);
      }
    });
  }

  function setBusy(b) {
    busy = b;
    ['cpc-ai-improve', 'cpc-ai-suggest', 'cpc-ai-reason'].forEach((id) =>
      document.getElementById(id)?.classList.toggle('cpc-busy', b));
  }

  async function onImprove() {
    if (busy) return;
    const draft = (composer()?.value || '').trim();
    if (!draft) { toast('Digite um rascunho primeiro.'); return; }
    setBusy(true);
    const r = await call('improve', { draft, conversation: gather() });
    setBusy(false);
    if (r?.result) showPop(r.result);
  }

  async function onSuggest() {
    if (busy) return;
    setBusy(true);
    const r = await call('suggest', { conversation: gather() });
    setBusy(false);
    if (r?.result) showPop(r.result);
  }

  async function onReason() {
    if (busy) return;
    setBusy(true);
    const r = await call('reason', { conversation: gather(40) });
    setBusy(false);
    if (r && r.reason) showReasonPop(r);
    else if (r) toast('Não consegui identificar o motivo.');
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('Copiado: ' + text); }
    catch { toast('Falha ao copiar.'); }
  }

  // --- Finalização automática pelo fluxo nativo do Sendi ---
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  // Espera cond() virar verdadeiro (poll), até timeout. Retorna o valor ou null.
  async function waitFor(cond, timeout = 2500, step = 100) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = cond();
      if (v) return v;
      await delay(step);
    }
    return null;
  }

  // Escreve em input/textarea React-controlado (setter nativo + evento input).
  function setNativeValue(el, text) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Botão "Finalizar" do cabeçalho da conversa (abre um popover com busca de motivos).
  function findFinalizeBtn() {
    return document.querySelector(S.finalizeBtn);
  }

  // Visível = tem caixa renderizada. Não usa offsetParent (dá null em position:fixed).
  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }

  // Clique robusto: alguns menus React abrem no mousedown/pointerdown, não no click.
  function fullClick(el) {
    const opts = { bubbles: true, cancelable: true, view: window };
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
      const E = type.startsWith('pointer') ? PointerEvent : MouseEvent;
      try { el.dispatchEvent(new E(type, opts)); } catch { el.dispatchEvent(new MouseEvent(type === 'pointerdown' ? 'mousedown' : type === 'pointerup' ? 'mouseup' : type, opts)); }
    });
  }

  // Acha o item da lista cujo texto bate com o motivo (exato primeiro, depois contém).
  function findReasonItem(reason, scope) {
    const want = reason.trim().toUpperCase();
    const items = [...(scope || document).querySelectorAll(S.reasonItem)];
    return items.find((el) => (el.textContent || '').trim().toUpperCase() === want) ||
           items.find((el) => (el.textContent || '').trim().toUpperCase().includes(want)) || null;
  }

  async function finalizeWith(reason) {
    if (busy) return;
    // Ação IRREVERSÍVEL: confirma antes.
    if (!confirm(`Finalizar este atendimento com o motivo:\n\n${reason}\n\nConfirmar?`)) return;
    setBusyReason(true);
    try {
      const btn = findFinalizeBtn();
      if (!btn) { toast('Botão "Finalizar" não encontrado.'); return; }

      // Popover aberto = o que tem o campo de busca de motivos.
      const popoverOf = () => [...document.querySelectorAll(S.popover)]
        .find((p) => p.querySelector(S.reasonSearchInput) && isVisible(p)) || null;
      if (!popoverOf()) fullClick(btn);
      const pop = await waitFor(popoverOf, 3000);
      if (!pop) { toast('A lista de motivos não abriu.'); return; }

      // A lista pode ser filtrada/virtualizada: digita o motivo na busca e procura de novo.
      let item = findReasonItem(reason, pop);
      if (!item) {
        const search = pop.querySelector(S.reasonSearchInput);
        if (search) { search.focus(); setNativeValue(search, reason); }
        item = await waitFor(() => findReasonItem(reason, pop), 2500);
      }
      if (!item) { toast('Motivo não encontrado na lista do Sendi.'); return; }
      fullClick(item);
      toast('Atendimento finalizado: ' + reason);
      document.getElementById('cpc-ai-reason-pop')?.remove();
    } finally {
      setBusyReason(false);
    }
  }

  // Ação ao clicar num motivo, conforme a preferência (copiar ou finalizar).
  function onReasonPick(reason) {
    if (cfg.reasonAction === 'finalize') finalizeWith(reason);
    else copyText(reason);
  }

  function setBusyReason(b) {
    document.getElementById('cpc-ai-reason-pop')?.classList.toggle('cpc-busy', b);
  }

  // Escapa texto vindo da IA antes de entrar em innerHTML.
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function showReasonPop(data) {
    let pop = document.getElementById('cpc-ai-reason-pop');
    if (pop) pop.remove();
    pop = document.createElement('div');
    pop.id = 'cpc-ai-reason-pop';

    const finalize = cfg.reasonAction === 'finalize';
    const actIcon = window.CPC_icon(finalize ? 'check' : 'copy', 15);

    // Cada motivo é UMA linha clicável; a ação (copiar/finalizar) vem das preferências.
    const row = (reason, main) => `
      <button class="cpc-r-item${main ? ' cpc-r-item--main' : ''}" data-r="${encodeURIComponent(reason)}">
        <span class="cpc-r-text">${esc(reason)}</span>
        <span class="cpc-r-act">${actIcon}</span>
      </button>`;

    const alts = (data.alternatives || []).map((a) => row(a, false)).join('');

    pop.innerHTML = `
      <div class="cpc-r-head">
        <span class="cpc-r-title">Motivo de finalização</span>
        <span class="cpc-r-mode cpc-r-mode--${finalize ? 'finish' : 'copy'}">${window.CPC_icon(finalize ? 'check' : 'copy', 13)}${finalize ? 'Finalizar' : 'Copiar'}</span>
      </div>
      <div class="cpc-r-reco">Recomendado</div>
      ${row(data.reason, true)}
      ${data.justificativa ? `<div class="cpc-r-just">${esc(data.justificativa)}</div>` : ''}
      ${alts ? `<div class="cpc-r-sub">Alternativas</div>${alts}` : ''}
      <div class="cpc-r-legend">Clique num motivo para ${finalize ? '<b>finalizar</b> o atendimento' : '<b>copiar</b> o texto'}. Altere no popup da extensão.</div>
      <div class="cpc-r-actions"><button id="cpc-r-close" type="button">Fechar</button></div>`;
    document.body.appendChild(pop);

    pop.querySelectorAll('.cpc-r-item').forEach((b) =>
      b.addEventListener('click', () => onReasonPick(decodeURIComponent(b.dataset.r)))
    );
    pop.querySelector('#cpc-r-close').addEventListener('click', () => pop.remove());
  }

  function showPop(text) {
    let pop = document.getElementById('cpc-ai-pop');
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'cpc-ai-pop';
      pop.innerHTML = `
        <div class="cpc-ai-pop-text"></div>
        <div class="cpc-ai-pop-actions">
          <button id="cpc-ai-apply" type="button">Usar</button>
          <button id="cpc-ai-close" type="button">Descartar</button>
        </div>`;
      document.body.appendChild(pop);
      pop.querySelector('#cpc-ai-close').addEventListener('click', () => pop.remove());
      pop.querySelector('#cpc-ai-apply').addEventListener('click', () => {
        setComposer(pop.dataset.text || '');
        pop.remove();
      });
    }
    pop.dataset.text = text;
    pop.querySelector('.cpc-ai-pop-text').textContent = text;
    pop.style.display = 'block';
  }

  let toastId = null;
  function toast(msg) {
    let t = document.getElementById('cpc-ai-toast');
    if (!t) { t = document.createElement('div'); t.id = 'cpc-ai-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toastId);
    toastId = setTimeout(() => { t.style.display = 'none'; }, 3500);
  }

  function refresh() { ensureDockButtons(); }

  async function init() {
    await reload();
    chrome.storage.onChanged.addListener((c) => { if (c.cpc_prefs) reload(); });
  }

  return { init, refresh };
})();
