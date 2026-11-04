// Ponte (mundo isolado): lê as preferências de som e envia ao hook que roda na página.
// O canal é um CustomEvent no document com a config como STRING (objetos não atravessam mundos).
window.CPC_Sound = (function () {
  async function apply() {
    const p = await window.CPC_store.getPrefs();
    const detail = JSON.stringify({
      msg: p.soundMsg || 'padrao',
      other: p.soundOther || 'padrao',
      volume: typeof p.soundVolume === 'number' ? p.soundVolume : 70,
      file: p.soundFile || '',
      onlyBackground: !!p.soundOnlyBackground,
    });
    document.dispatchEvent(new CustomEvent('cpc-sound-config', { detail }));
  }
  return { apply };
})();
