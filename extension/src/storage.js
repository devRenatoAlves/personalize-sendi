// Wrapper de chrome.storage.local para as preferências.
window.CPC_store = {
  // --- Preferências de tema ---
  async getPrefs() {
    const { cpc_prefs } = await chrome.storage.local.get('cpc_prefs');
    return Object.assign(
      {
        themeEnabled: false, cleanMode: false, glassMode: false, glassOpacity: 45, glassBlur: 16, bgImage: '', accent: '#2563eb',
        overlay: 0.4, autoColors: true, paletteHeader: '', paletteSide: '',
        paletteBubbleOut: '', paletteBubbleIn: '',
        
        clientLink: true, clientLinkDomain: '', dockColor: '',
        aiUrl: '', aiToken: '', aiImprove: true, aiSuggest: true, aiReason: true,
        reasonAction: 'copy', // 'copy' = copiar texto | 'finalize' = finalizar atendimento
      },
      cpc_prefs || {}
    );
  },

  async setPrefs(patch) {
    const prefs = await this.getPrefs();
    const next = Object.assign(prefs, patch);
    await chrome.storage.local.set({ cpc_prefs: next });
    return next;
  },
};
