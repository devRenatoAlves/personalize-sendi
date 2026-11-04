// Roda no MUNDO DA PÁGINA (content script com world: "MAIN"), antes do app carregar.
// O Sendi toca o aviso de mensagem com osciladores do Web Audio (dois tons curtos). Aqui
// interceptamos OscillatorNode.start: se o usuário escolheu outro som, os tons originais
// são silenciados e tocamos o escolhido. Sem configuração (ou com "Padrão"), nada muda.
(function () {
  if (window.__cpcSoundHooked) return;
  window.__cpcSoundHooked = true;

  let cfg = { msg: 'padrao', other: 'padrao', volume: 70, file: '', onlyBackground: false };

  document.addEventListener('cpc-sound-config', (e) => {
    try { cfg = Object.assign(cfg, JSON.parse(e.detail)); } catch { /* ignora config inválida */ }
  });

  // Tons do Sendi (useNotificationSound): nova mensagem = seno 880 → 1174,7 Hz;
  // outros avisos = triângulo 987,8 → 740 Hz. Identificamos pelo par (tipo, frequência).
  function classify(osc) {
    const type = osc.type;
    const f = osc.frequency.value;
    const near = (a, b) => Math.abs(a - b) < 1;
    if (type === 'sine' && near(f, 880)) return { ev: 'msg', first: true };
    if (type === 'sine' && near(f, 1174.7)) return { ev: 'msg', first: false };
    if (type === 'triangle' && near(f, 987.8)) return { ev: 'other', first: true };
    if (type === 'triangle' && near(f, 740)) return { ev: 'other', first: false };
    return null;
  }

  const origStart = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (...args) {
    try {
      if (!this.context.__cpc) {
        const k = classify(this);
        // "Só em segundo plano": com o Sendi à frente (aba visível E janela com foco) o aviso
        // é silenciado — vale também para o som padrão do Sendi.
        if (k && cfg.onlyBackground && document.visibilityState === 'visible' && document.hasFocus()) {
          this.disconnect();
        } else if (k) {
          const choice = cfg[k.ev];
          if (choice && choice !== 'padrao') {
            if (k.first && window.CPC_Sounds) window.CPC_Sounds.play(choice, cfg.volume, cfg.file);
            // Silencia o tom original SEM quebrar o app: o código do Sendi chama start() e
            // depois stop(); pular o start faria o stop() lançar InvalidStateError e derrubaria o
            // resto do tratamento da mensagem (ex.: a notificação do navegador).
            this.disconnect();
          }
        }
      }
    } catch { /* qualquer falha: cai no som original */ }
    return origStart.apply(this, args);
  };
})();
