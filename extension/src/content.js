// Ponto de entrada: observa o DOM do Sendi e mantém tema + IA.
(function () {
  // Re-sincroniza com debounce para não rodar a cada mutação.
  let debounceId = null;
  function scheduleSync() {
    clearTimeout(debounceId);
    debounceId = setTimeout(() => {
      window.CPC_AI.refresh();
      window.CPC_ClientLink.refresh();
    }, 200);
  }

  function startObserver() {
    // body: pega mudanças de cards, da conversa aberta e do composer.
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function init() {
    await window.CPC_Theme.apply();
    await window.CPC_AI.init();
    await window.CPC_ClientLink.init();
    window.CPC_AI.refresh();
    window.CPC_ClientLink.refresh();
    startObserver();
  }

  // Reage a mudanças de preferências feitas no popup.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.cpc_prefs) window.CPC_Theme.apply();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
