// Botão flutuante: abre o sistema do cliente em nova guia.
// Lê o link direto do painel de identificação (chat-aside--lead) sem precisar abri-lo —
// o React mantém o painel montado quando a conversa está aberta, então os campos
// (incl. o link do subdomínio do cliente) ficam legíveis no DOM.
window.CPC_ClientLink = (function () {
  const S = window.CPC_SELECTORS;
  const DEFAULT_FILTER = ''; // sem padrão: defina clientLinkFilter (trecho do host do sistema do cliente)
  let cfg = { enabled: true, filter: DEFAULT_FILTER };

  async function reload() {
    const p = await window.CPC_store.getPrefs();
    cfg = {
      enabled: p.clientLink !== false,
      filter: (p.clientLinkFilter || '').trim().toLowerCase() || DEFAULT_FILTER,
    };
    refresh();
  }

  // Junta todo texto onde o link pode estar: hrefs, valores de campos e o texto do painel.
  function leadText() {
    const lead = document.querySelector(S.chatAsideLead + '.active') ||
                 document.querySelector(S.chatAsideLead);
    if (!lead) return null;
    const parts = [];
    lead.querySelectorAll('a[href]').forEach((a) => parts.push(a.getAttribute('href') || ''));
    lead.querySelectorAll('input, textarea').forEach((i) => parts.push(i.value || ''));
    parts.push(lead.textContent || '');
    return parts.join('\n');
  }

  // Acha o link do cliente no painel lead. Reconhece o host que CONTÉM cfg.filter
  // (ex.: "meusistema"), com ou sem "https://", e adiciona o esquema quando falta.
  // Captura o host inteiro (subdominio + domínio + TLD), então:
  //   "cliente.meusistema.com.br" → https://cliente.meusistema.com.br
  // Um email como "contato@cliente.com.br" não casa (não tem "meusistema").
  function findLink() {
    if (!cfg.filter) return null;
    const hay = leadText();
    if (!hay) return null;

    const esc = cfg.filter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:https?:\\/\\/)?[a-z0-9.-]*' + esc + '[a-z0-9.-]*(?:\\/[^\\s"\'<>]*)?', 'i');
    const m = hay.match(re);
    if (!m) return null;

    const url = m[0].replace(/[.,;]+$/, ''); // remove pontuação final
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
  }

  // Vive no dock compartilhado (criado por ai.js), junto do botão "Motivo".
  function ensureButton() {
    let btn = document.getElementById('cpc-clientlink');
    const url = cfg.enabled ? findLink() : null;
    if (!url) { if (btn) btn.remove(); return; }
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'cpc-clientlink';
      btn.type = 'button';
      btn.className = 'cpc-dock-btn';
      btn.style.order = '2';
      btn.dataset.icon = '🔗';
      btn.innerHTML = '<span class="cpc-dock-label">Sistema do cliente</span>';
      btn.addEventListener('click', () => {
        const u = btn.dataset.url;
        if (u) window.open(u, '_blank', 'noopener');
      });
      (window.CPC_dock ? window.CPC_dock() : document.body).appendChild(btn);
    }
    btn.dataset.url = url;
  }

  function refresh() { ensureButton(); }

  async function init() {
    await reload();
    chrome.storage.onChanged.addListener((c) => { if (c.cpc_prefs) reload(); });
  }

  return { init, refresh };
})();
