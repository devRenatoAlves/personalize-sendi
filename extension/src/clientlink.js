// Botão flutuante "Sistema do cliente": abre <estabelecimento>.<domínio> em nova guia.
// O estabelecimento vem do nome do contato no cabeçalho da conversa, no padrão
// "fulano - estabelecimento" (ex.: "Mariane - boinoespeto" → https://boinoespeto.<domínio>).
// Fora do padrão = sem botão. O domínio é configurável no popup (clientLinkDomain).
window.CPC_ClientLink = (function () {
  const S = window.CPC_SELECTORS;
  let cfg = { enabled: true, domain: '' };

  async function reload() {
    const p = await window.CPC_store.getPrefs();
    cfg = { enabled: p.clientLink !== false, domain: normDomain(p.clientLinkDomain) };
    refresh();
  }

  // Aceita "exemplo.com.br", "https://exemplo.com.br/" ou "*.exemplo.com.br". Inválido → ''.
  function normDomain(v) {
    const d = String(v || '').trim().toLowerCase()
      .replace(/^https?:\/\//, '').replace(/^\*?\./, '').replace(/\/.*$/, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : '';
  }

  // "fulano - estabelecimento" → "estabelecimento". Regras estritas, de propósito:
  // precisa do separador " - " e o último trecho tem de ser UMA palavra [a-z0-9-]
  // (já é um subdomínio válido). Nome com espaço/acento/símbolo no fim → null.
  function establishment(name) {
    const parts = String(name || '').trim().split(/\s+-\s+/);
    if (parts.length < 2 || !parts[0].trim()) return null;
    const sub = parts[parts.length - 1].trim().toLowerCase();
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sub) ? sub : null;
  }

  function contactName() {
    const el = document.querySelector(S.contactName);
    return el ? el.textContent : '';
  }

  function findLink() {
    if (!cfg.domain) return null;
    const sub = establishment(contactName());
    return sub ? `https://${sub}.${cfg.domain}` : null;
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
      btn.title = 'Sistema do cliente';
      btn.innerHTML = window.CPC_icon('external-link', 17) + '<span class="cpc-dock-label">Sistema do cliente</span>';
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

  return { init, refresh, establishment };
})();
