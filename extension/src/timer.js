// Cronômetro por atendimento — início AUTOMÁTICO ao clicar em "Atender" (pegar o atendimento).
// Não há botão flutuante para iniciar/parar: o pickup do atendimento dispara o cronômetro.
// Persistido por UUID do /chat/<uuid>; troca de aba/reload não reinicia.
// Ao abrir um atendimento finalizado, o timer daquele card é removido. Limpa +24h.
window.CPC_Timer = (function () {
  const S = window.CPC_SELECTORS;
  const MAX_AGE_MS = 24 * 60 * 60 * 1000; // limpa timers com +24h

  // "Atendimento finalizado por ..." (só no chat encerrado)
  const RE_FINALIZED = /atendimento\s+finalizado\s+por/i;

  // Texto do botão de pickup. "atender" NÃO casa "atendimento" (atendiMENTO).
  const RE_ATENDER = /\batender\b/i;

  function fmt(ms) {
    if (ms < 0) ms = 0;
    const total = Math.floor(ms / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, '0');
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  // Procura o texto re em toda a árvore (conversa aberta).
  function bodyHasText(re, hint) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.nodeValue;
      if (txt && txt.indexOf(hint) !== -1 && re.test(txt)) return true;
    }
    return false;
  }

  const isFinalized = () => bodyHasText(RE_FINALIZED, 'finalizado');

  function activeCardId() {
    const active = document.querySelector(S.cardActive);
    return active ? window.CPC_getCardId(active) : null;
  }

  // Atendimento finalizado → remove o timer daquele card.
  async function cleanupFinalized() {
    const cardId = activeCardId();
    if (cardId && isFinalized()) await window.CPC_store.removeTimer(cardId);
  }

  function ensureBadge(cardEl, startedAt) {
    let badge = cardEl.querySelector('.cpc-timer');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cpc-timer';
      const slot = cardEl.querySelector(S.cardSlot) || cardEl;
      slot.appendChild(badge);
    }
    badge.dataset.startedAt = String(startedAt);
  }

  function removeBadge(cardEl) {
    const badge = cardEl.querySelector('.cpc-timer');
    if (badge) badge.remove();
  }

  // SLA: verde até <amarelo>min, amarelo até <vermelho>min, vermelho depois. Config via storage.
  let slaEnabled = true;
  let slaYellow = 5;  // minutos p/ ficar amarelo
  let slaRed = 15;    // minutos p/ ficar vermelho
  const SLA = ['cpc-sla-green', 'cpc-sla-yellow', 'cpc-sla-red'];
  function slaClass(ms) {
    const min = ms / 60000;
    if (min < slaYellow) return 'cpc-sla-green';
    if (min < slaRed) return 'cpc-sla-yellow';
    return 'cpc-sla-red';
  }

  function tick() {
    document.querySelectorAll('.cpc-timer').forEach((badge) => {
      const startedAt = Number(badge.dataset.startedAt || 0);
      if (!startedAt) return;
      const ms = Date.now() - startedAt;
      badge.textContent = fmt(ms);
      const want = slaEnabled ? slaClass(ms) : null;
      SLA.forEach((c) => badge.classList.toggle(c, c === want));
    });
  }

  async function refreshSla() {
    const prefs = await window.CPC_store.getPrefs();
    slaEnabled = prefs.slaColors !== false;
    slaYellow = Number(prefs.slaYellow) > 0 ? Number(prefs.slaYellow) : 5;
    slaRed = Number(prefs.slaRed) > 0 ? Number(prefs.slaRed) : 15;
  }

  // --- Pickup: clique em "Atender" inicia o cronômetro do atendimento aberto ---
  // Capture-phase: lê o card ativo no instante do clique (antes do React re-renderizar).
  async function onAtenderClick(e) {
    const btn = e.target.closest && e.target.closest('button, a, [role="button"]');
    if (!btn) return;
    const txt = (btn.textContent || '').trim();
    if (txt.length > 20 || !RE_ATENDER.test(txt)) return;
    const id = activeCardId();
    if (!id) return;
    await window.CPC_store.setTimerStart(id, Date.now()); // não reinicia se já existir
    sync();
  }

  async function sync() {
    await cleanupFinalized();
    const timers = await window.CPC_store.getTimers();
    document.querySelectorAll(S.card).forEach((card) => {
      const id = window.CPC_getCardId(card);
      if (id && timers[id]) ensureBadge(card, timers[id]);
      else removeBadge(card);
    });
    tick();
  }

  let intervalId = null;
  function start() {
    if (intervalId) return;
    window.CPC_store.pruneOld(MAX_AGE_MS);
    refreshSla();
    chrome.storage.onChanged.addListener(async (c) => {
      if (c.cpc_prefs) { await refreshSla(); sync(); }
    });
    document.addEventListener('click', onAtenderClick, true); // pickup → inicia timer
    intervalId = setInterval(tick, 1000);
  }
  function stop() {
    clearInterval(intervalId);
    intervalId = null;
  }

  return { sync, start, stop, tick };
})();
