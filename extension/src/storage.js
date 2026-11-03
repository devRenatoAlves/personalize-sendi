// Wrapper de chrome.storage.local para timers e preferências.
window.CPC_store = {
  // --- Timers: { [cardId]: startedAt(ms) } ---
  async getTimers() {
    const { cpc_timers } = await chrome.storage.local.get('cpc_timers');
    return cpc_timers || {};
  },

  async setTimerStart(cardId, startedAt) {
    const timers = await this.getTimers();
    if (timers[cardId]) return timers[cardId]; // já existe, não reinicia
    timers[cardId] = startedAt;
    await chrome.storage.local.set({ cpc_timers: timers });
    return startedAt;
  },

  // Grava à força (clique em "Atender" = pickup autoritativo, sobrescreve fallback).
  async forceTimerStart(cardId, startedAt) {
    const timers = await this.getTimers();
    timers[cardId] = startedAt;
    await chrome.storage.local.set({ cpc_timers: timers });
    return startedAt;
  },

  async removeTimer(cardId) {
    const timers = await this.getTimers();
    if (cardId in timers) {
      delete timers[cardId];
      await chrome.storage.local.set({ cpc_timers: timers });
    }
  },

  // Limpeza por idade (não por ausência no DOM — trocar de aba não pode apagar).
  async pruneOld(maxAgeMs) {
    const timers = await this.getTimers();
    const now = Date.now();
    let changed = false;
    for (const id of Object.keys(timers)) {
      if (now - timers[id] > maxAgeMs) {
        delete timers[id];
        changed = true;
      }
    }
    if (changed) await chrome.storage.local.set({ cpc_timers: timers });
  },

  // --- Preferências de tema ---
  async getPrefs() {
    const { cpc_prefs } = await chrome.storage.local.get('cpc_prefs');
    return Object.assign(
      {
        timerEnabled: true, themeEnabled: false, bgImage: '', accent: '#2563eb',
        overlay: 0.4, autoColors: true, paletteHeader: '', paletteSide: '',
        paletteBubbleOut: '', paletteBubbleIn: '',
        logoImage: '', logoRound: false, slaColors: true, slaYellow: 5, slaRed: 15,
        clientLink: true, clientLinkFilter: '', dockColor: '',
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
