// Sons de notificação sintetizados (Web Audio), sem arquivos de áudio.
// Compartilhado entre o popup (pré-visualização) e a página (mundo MAIN, ver sound-main.js).
window.CPC_Sounds = (function () {
  // id 'padrao' = não mexe (toca o som original do Sendi); 'mudo' = silêncio;
  // 'arquivo' = áudio enviado pelo usuário (data URL guardada nas preferências).
  const PRESETS = [
    { id: 'padrao', name: 'Padrão do Sendi' },
    { id: 'sino', name: 'Sino' },
    { id: 'gota', name: 'Gota' },
    { id: 'pop', name: 'Pop' },
    { id: 'marimba', name: 'Marimba' },
    { id: 'digital', name: 'Digital' },
    { id: 'suave', name: 'Suave' },
    { id: 'arquivo', name: 'Meu arquivo' },
    { id: 'mudo', name: 'Silêncio' },
  ];

  // Cada nota: f = Hz, t = atraso (s), d = duração (s), type, g = ganho relativo,
  // to = frequência final (glide exponencial).
  const NOTES = {
    sino: [
      { f: 1318.5, t: 0, d: 1.1, type: 'sine', g: 1 },
      { f: 2637, t: 0, d: 0.6, type: 'sine', g: 0.3 },
      { f: 3951, t: 0, d: 0.3, type: 'sine', g: 0.12 },
    ],
    gota: [{ f: 1500, to: 520, t: 0, d: 0.16, type: 'sine', g: 1 }],
    pop: [{ f: 640, to: 280, t: 0, d: 0.08, type: 'sine', g: 1 }],
    marimba: [
      { f: 659.3, t: 0, d: 0.4, type: 'sine', g: 1 },
      { f: 784, t: 0.09, d: 0.4, type: 'sine', g: 0.9 },
      { f: 1046.5, t: 0.18, d: 0.5, type: 'sine', g: 0.8 },
    ],
    digital: [
      { f: 1000, t: 0, d: 0.06, type: 'square', g: 0.35 },
      { f: 1000, t: 0.1, d: 0.06, type: 'square', g: 0.35 },
      { f: 1400, t: 0.2, d: 0.09, type: 'square', g: 0.35 },
    ],
    // Só para pré-visualizar o som original do Sendi (o hook nunca o toca: 'padrao' = deixa passar).
    padrao: [
      { f: 880, t: 0, d: 0.13, type: 'sine', g: 1 },
      { f: 1174.7, t: 0.11, d: 0.13, type: 'sine', g: 1 },
    ],
    suave: [
      { f: 523.25, t: 0, d: 0.55, type: 'triangle', g: 1 },
      { f: 659.25, t: 0.15, d: 0.7, type: 'triangle', g: 0.9 },
    ],
  };

  let ctx = null;
  function context() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      ctx.__cpc = true; // sinaliza ao hook do sound-main para não interceptar os nossos osciladores
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function playSynth(id, volume) {
    const notes = NOTES[id];
    const c = context();
    if (!notes || !c) return;
    const master = c.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume)) * 0.3;
    master.connect(c.destination);
    const now = c.currentTime;
    notes.forEach((n) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = n.type;
      const t0 = now + n.t;
      o.frequency.setValueAtTime(n.f, t0);
      if (n.to) o.frequency.exponentialRampToValueAtTime(n.to, t0 + n.d);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(n.g, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d);
      o.connect(g).connect(master);
      o.start(t0);
      o.stop(t0 + n.d + 0.02);
    });
  }

  function playFile(dataUrl, volume) {
    if (!dataUrl) return;
    try {
      const a = new Audio(dataUrl);
      a.volume = Math.max(0, Math.min(1, volume));
      a.play().catch(() => {});
    } catch { /* arquivo inválido: silêncio */ }
  }

  // volume: 0..100
  function play(id, volume, file) {
    const v = (typeof volume === 'number' ? volume : 70) / 100;
    if (id === 'mudo' || id === 'padrao') return;
    if (id === 'arquivo') return playFile(file, v);
    playSynth(id, v);
  }

  // Pré-visualização no popup: também toca o 'padrao' (aproximação do original).
  function preview(id, volume, file) {
    if (id === 'padrao') return playSynth('padrao', (typeof volume === 'number' ? volume : 70) / 100);
    play(id, volume, file);
  }

  return { PRESETS, play, preview };
})();
