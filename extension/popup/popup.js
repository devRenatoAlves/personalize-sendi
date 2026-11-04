window.CPC_hydrateIcons();
// Lê e grava preferências em chrome.storage.local.
const DEFAULTS = {
  themeEnabled: false,
  bgImage: '',
  accent: '#2563eb',
  overlay: 0.4,
  glassMode: false,
  glassOpacity: 45,
  glassBlur: 16,
  cleanMode: false,
  soundMsg: 'padrao',
  soundOther: 'padrao',
  soundVolume: 70,
  soundFile: '',
  soundFileName: '',
  soundOnlyBackground: false,
  autoColors: true,
  paletteHeader: '',
  paletteSide: '',
  paletteBubbleOut: '',
  paletteBubbleIn: '',
  clientLink: true,
  clientLinkDomain: '',
  dockColor: '',
  aiUrl: '',
  aiToken: '',
  aiImprove: true,
  aiSuggest: true,
  aiReason: true,
  reasonAction: 'copy',
};

const els = {
  themeEnabled: document.getElementById('themeEnabled'),
  bgImage: document.getElementById('bgImage'),
  overlay: document.getElementById('overlay'),
  overlayVal: document.getElementById('overlayVal'),
  glassMode: document.getElementById('glassMode'),
  glassOpts: document.getElementById('glassOpts'),
  glassOpacity: document.getElementById('glassOpacity'),
  glassOpacityVal: document.getElementById('glassOpacityVal'),
  glassBlur: document.getElementById('glassBlur'),
  glassBlurVal: document.getElementById('glassBlurVal'),
  autoColors: document.getElementById('autoColors'),
  paletteHeader: document.getElementById('paletteHeader'),
  paletteSide: document.getElementById('paletteSide'),
  paletteBubbleOut: document.getElementById('paletteBubbleOut'),
  paletteBubbleIn: document.getElementById('paletteBubbleIn'),
  paletteClear: document.getElementById('paletteClear'),
  paletteSub: document.getElementById('paletteSub'),
  domainPreview: document.getElementById('domainPreview'),
  clientLinkOpts: document.getElementById('clientLinkOpts'),
  tokenToggle: document.getElementById('tokenToggle'),
  finalizeWarn: document.getElementById('finalizeWarn'),
  presets: document.getElementById('presets'),
  soundMsg: document.getElementById('soundMsg'),
  soundOther: document.getElementById('soundOther'),
  soundVolume: document.getElementById('soundVolume'),
  soundOnlyBackground: document.getElementById('soundOnlyBackground'),
  soundVolumeVal: document.getElementById('soundVolumeVal'),
  playMsg: document.getElementById('playMsg'),
  playOther: document.getElementById('playOther'),
  soundFileName: document.getElementById('soundFileName'),
  soundFileBtn: document.getElementById('soundFileBtn'),
  soundFileClear: document.getElementById('soundFileClear'),
  soundFileInput: document.getElementById('soundFileInput'),
  soundStatus: document.getElementById('soundStatus'),
  themeOpts: document.getElementById('themeOpts'),
  aiUrl: document.getElementById('aiUrl'),
  aiToken: document.getElementById('aiToken'),
  aiImprove: document.getElementById('aiImprove'),
  aiSuggest: document.getElementById('aiSuggest'),
  aiReason: document.getElementById('aiReason'),
  reasonOpts: document.getElementById('reasonOpts'),
  reasonCopy: document.getElementById('reasonCopy'),
  reasonFinish: document.getElementById('reasonFinish'),
  cleanMode: document.getElementById('cleanMode'),
  clientLink: document.getElementById('clientLink'),
  clientLinkDomain: document.getElementById('clientLinkDomain'),
  dockColor: document.getElementById('dockColor'),
  dockColorAuto: document.getElementById('dockColorAuto'),
  dockColorSub: document.getElementById('dockColorSub'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  backupStatus: document.getElementById('backupStatus'),
};

// false = cores derivadas da imagem; true = paleta manual (2 cores) sobrepõe a extração.
let paletteManual = false;
// false = balões com degradê padrão; true = cor personalizada (dockColor).
let dockManual = false;
// Ação ao clicar num motivo: 'copy' | 'finalize'.
let reasonAction = 'copy';
// 'accent' não tem controle no popup (a cor dos botões é o dockColor); preservamos o valor salvo.
let accentPref = '#2563eb';
// Arquivo de som do usuário (data URL) e nome; ficam em memória até o save().
let soundFile = '';
let soundFileName = '';

function refreshUI() {
  els.themeOpts.classList.toggle('disabled', !els.themeEnabled.checked);
  els.reasonOpts.classList.toggle('disabled', !els.aiReason.checked);
  els.reasonCopy.classList.toggle('active', reasonAction === 'copy');
  els.reasonFinish.classList.toggle('active', reasonAction === 'finalize');
  [els.overlay, els.glassOpacity, els.glassBlur, els.soundVolume].forEach((r) => {
    r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
  });
  els.soundVolumeVal.textContent = `${els.soundVolume.value}%`;
  els.soundFileName.textContent = soundFileName || 'Nenhum arquivo';
  els.soundFileClear.disabled = !soundFile;
  [els.soundMsg, els.soundOther].forEach((sel) => {
    const o = [...sel.options].find((x) => x.value === 'arquivo');
    if (o) o.disabled = !soundFile;
  });
  els.overlayVal.textContent = `${els.overlay.value}%`;
  els.glassOpacityVal.textContent = `${els.glassOpacity.value}%`;
  els.glassBlurVal.textContent = `${els.glassBlur.value}px`;
  els.glassOpts.classList.toggle('disabled', !els.glassMode.checked);
  els.paletteClear.classList.toggle('active', !paletteManual);
  els.dockColorAuto.classList.toggle('active', !dockManual);
  els.dockColorSub.textContent = dockManual
    ? 'Cor personalizada.'
    : 'Usando o degradê padrão.';
  els.reasonFinish.classList.toggle('danger', reasonAction === 'finalize');
  els.reasonCopy.setAttribute('aria-checked', String(reasonAction === 'copy'));
  els.reasonFinish.setAttribute('aria-checked', String(reasonAction === 'finalize'));
  els.finalizeWarn.hidden = reasonAction !== 'finalize';
  els.clientLinkOpts.classList.toggle('disabled', !els.clientLink.checked);
  els.domainPreview.textContent = els.clientLinkDomain.value.trim() || 'exemplo.com.br';
  els.paletteSub.textContent = paletteManual
    ? 'Paleta própria — sobrepõe as cores da imagem.'
    : 'Usando as cores da imagem de fundo.';
  markPreset();
}

async function load() {
  const { cpc_prefs } = await chrome.storage.local.get('cpc_prefs');
  const prefs = Object.assign({}, DEFAULTS, cpc_prefs || {});
  accentPref = prefs.accent || '#2563eb';
  soundFile = prefs.soundFile || '';
  soundFileName = prefs.soundFileName || '';
  els.soundMsg.value = prefs.soundMsg || 'padrao';
  els.soundOther.value = prefs.soundOther || 'padrao';
  els.soundOnlyBackground.checked = !!prefs.soundOnlyBackground;
  els.soundVolume.value = typeof prefs.soundVolume === 'number' ? prefs.soundVolume : 70;
  els.themeEnabled.checked = !!prefs.themeEnabled;
  els.bgImage.value = prefs.bgImage || '';
  els.overlay.value = Math.round((prefs.overlay ?? 0.4) * 100);
  els.glassMode.checked = !!prefs.glassMode;
  els.glassOpacity.value = prefs.glassOpacity ?? 45;
  els.glassBlur.value = prefs.glassBlur ?? 16;
  els.autoColors.checked = prefs.autoColors !== false;
  paletteManual = !!(prefs.paletteHeader && prefs.paletteSide);
  if (prefs.paletteHeader) els.paletteHeader.value = prefs.paletteHeader;
  if (prefs.paletteSide) els.paletteSide.value = prefs.paletteSide;
  if (prefs.paletteBubbleOut) els.paletteBubbleOut.value = prefs.paletteBubbleOut;
  if (prefs.paletteBubbleIn) els.paletteBubbleIn.value = prefs.paletteBubbleIn;
  els.aiUrl.value = prefs.aiUrl || '';
  els.aiToken.value = prefs.aiToken || '';
  els.aiImprove.checked = prefs.aiImprove !== false;
  els.aiSuggest.checked = prefs.aiSuggest !== false;
  els.aiReason.checked = prefs.aiReason !== false;
  reasonAction = prefs.reasonAction === 'finalize' ? 'finalize' : 'copy';
  els.cleanMode.checked = !!prefs.cleanMode;
  els.clientLink.checked = prefs.clientLink !== false;
  els.clientLinkDomain.value = prefs.clientLinkDomain || '';
  dockManual = !!prefs.dockColor;
  if (prefs.dockColor) els.dockColor.value = prefs.dockColor;
  refreshUI();
}

async function save() {
  const cpc_prefs = {
    themeEnabled: els.themeEnabled.checked,
    bgImage: els.bgImage.value.trim(),
    accent: accentPref,
    overlay: Number(els.overlay.value) / 100,
    glassMode: els.glassMode.checked,
    glassOpacity: Number(els.glassOpacity.value),
    glassBlur: Number(els.glassBlur.value),
    autoColors: els.autoColors.checked,
    paletteHeader: paletteManual ? els.paletteHeader.value : '',
    paletteSide: paletteManual ? els.paletteSide.value : '',
    paletteBubbleOut: paletteManual ? els.paletteBubbleOut.value : '',
    paletteBubbleIn: paletteManual ? els.paletteBubbleIn.value : '',
    aiUrl: els.aiUrl.value.trim(),
    aiToken: els.aiToken.value.trim(),
    aiImprove: els.aiImprove.checked,
    aiSuggest: els.aiSuggest.checked,
    aiReason: els.aiReason.checked,
    reasonAction,
    cleanMode: els.cleanMode.checked,
    soundMsg: els.soundMsg.value,
    soundOther: els.soundOther.value,
    soundVolume: Number(els.soundVolume.value),
    soundOnlyBackground: els.soundOnlyBackground.checked,
    soundFile,
    soundFileName,
    clientLink: els.clientLink.checked,
    clientLinkDomain: els.clientLinkDomain.value.trim(),
    dockColor: dockManual ? els.dockColor.value : '',
  };
  await chrome.storage.local.set({ cpc_prefs });
  refreshUI();
}

['themeEnabled', 'bgImage', 'overlay', 'glassMode', 'glassOpacity', 'glassBlur', 'autoColors',
 'aiUrl', 'aiToken', 'aiImprove', 'aiSuggest', 'aiReason', 'clientLink', 'clientLinkDomain', 'cleanMode', 'soundMsg', 'soundOther', 'soundVolume', 'soundOnlyBackground'].forEach((k) => {
  els[k].addEventListener('change', save);
  els[k].addEventListener('input', save);
});

// Mexer numa das cores ativa o modo manual; "Auto" volta às cores da imagem.
const onPalettePick = () => { paletteManual = true; save(); };
els.paletteHeader.addEventListener('input', onPalettePick);
els.paletteSide.addEventListener('input', onPalettePick);
els.paletteBubbleOut.addEventListener('input', onPalettePick);
els.paletteBubbleIn.addEventListener('input', onPalettePick);
els.paletteClear.addEventListener('click', () => { paletteManual = false; save(); });

// Cor dos balões flutuantes: escolher cor ativa o modo manual; "Auto" volta ao degradê.
els.dockColor.addEventListener('input', () => { dockManual = true; save(); });
els.dockColorAuto.addEventListener('click', () => { dockManual = false; save(); });

// Ação ao clicar no motivo: alterna copiar/finalizar.
els.reasonCopy.addEventListener('click', () => { reasonAction = 'copy'; save(); });
els.reasonFinish.addEventListener('click', () => { reasonAction = 'finalize'; save(); });

// --- Backup: exporta/importa todas as prefs em JSON ---
let backupStatusId = null;
function backupStatus(msg, ok = true) {
  els.backupStatus.textContent = msg;
  els.backupStatus.className = 'status ' + (ok ? 'ok' : 'err');
  clearTimeout(backupStatusId);
  backupStatusId = setTimeout(() => { els.backupStatus.textContent = ''; }, 4000);
}

async function exportPrefs() {
  const { cpc_prefs } = await chrome.storage.local.get('cpc_prefs');
  const prefs = Object.assign({}, DEFAULTS, cpc_prefs || {});
  const payload = { app: 'personalize-sendi', version: 1, prefs };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `personalize-sendi-config-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  backupStatus('Configurações exportadas.');
}

async function importPrefs(file) {
  try {
    const raw = JSON.parse(await file.text());
    const incoming = raw && raw.prefs ? raw.prefs : raw; // aceita {prefs:{}} ou prefs cru
    if (!incoming || typeof incoming !== 'object') throw new Error('formato');
    // Whitelist: só chaves conhecidas, evita injetar lixo no storage.
    const clean = {};
    for (const k of Object.keys(DEFAULTS)) {
      if (k in incoming) clean[k] = incoming[k];
    }
    if (!Object.keys(clean).length) throw new Error('vazio');
    await chrome.storage.local.set({ cpc_prefs: Object.assign({}, DEFAULTS, clean) });
    await load();
    backupStatus('Configurações importadas.');
  } catch {
    backupStatus('Arquivo inválido.', false);
  }
}

els.exportBtn.addEventListener('click', exportPrefs);
els.importBtn.addEventListener('click', () => els.importFile.click());
els.importFile.addEventListener('change', () => {
  const f = els.importFile.files[0];
  if (f) importPrefs(f);
  els.importFile.value = ''; // permite reimportar o mesmo arquivo
});

load();


// ---------- abas ----------
const tabs = [...document.querySelectorAll('.tab')];
function showTab(name) {
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
  document.querySelectorAll('.pane').forEach((p) => { p.hidden = p.dataset.pane !== name; });
  try { localStorage.setItem('cpc_tab', name); } catch { /* sem storage: ignora */ }
}
tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
let startTab = 'geral';
try { startTab = localStorage.getItem('cpc_tab') || 'geral'; } catch { /* ignora */ }
showTab(tabs.some((t) => t.dataset.tab === startTab) ? startTab : 'geral');

// ---------- token: mostrar/ocultar ----------
els.tokenToggle.addEventListener('click', () => {
  const show = els.aiToken.type === 'password';
  els.aiToken.type = show ? 'text' : 'password';
  els.tokenToggle.innerHTML = window.CPC_icon(show ? 'eye-off' : 'eye', 16);
  els.tokenToggle.setAttribute('aria-label', show ? 'Ocultar token' : 'Mostrar token');
});

// ---------- paletas prontas ----------
// [destaque, fundo, balão enviado, balão recebido]
const PRESETS = [
  { name: 'Oceano',     c: ['#2563eb', '#0f172a', '#1d4ed8', '#1e293b'] },
  { name: 'Floresta',   c: ['#059669', '#0f1f1a', '#047857', '#16302a'] },
  { name: 'Pôr do sol', c: ['#ea580c', '#1c1210', '#c2410c', '#2a1b17'] },
  { name: 'Uva',        c: ['#7c3aed', '#16112a', '#6d28d9', '#221a3d'] },
  { name: 'Grafite',    c: ['#64748b', '#18181b', '#475569', '#27272a'] },
  { name: 'Claro',      c: ['#2563eb', '#f1f5f9', '#2563eb', '#ffffff'] },
];
function applyPreset(c) {
  els.paletteHeader.value = c[0]; els.paletteSide.value = c[1];
  els.paletteBubbleOut.value = c[2]; els.paletteBubbleIn.value = c[3];
  paletteManual = true;
  save();
}
PRESETS.forEach((pr) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'preset'; b.title = pr.name; b.setAttribute('aria-label', 'Paleta ' + pr.name);
  b.style.background = pr.c[1]; b.style.setProperty('--c2', pr.c[0]);
  b.dataset.key = pr.c.join(',');
  b.addEventListener('click', () => applyPreset(pr.c));
  els.presets.appendChild(b);
});
function markPreset() {
  const cur = [els.paletteHeader, els.paletteSide, els.paletteBubbleOut, els.paletteBubbleIn].map((e) => e.value.toLowerCase()).join(',');
  els.presets.querySelectorAll('.preset').forEach((b) => b.classList.toggle('active', paletteManual && b.dataset.key === cur));
}


// ---------- som ----------
function fillSoundSelect(sel) {
  window.CPC_Sounds.PRESETS.forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id; o.textContent = p.name;
    sel.appendChild(o);
  });
}
fillSoundSelect(els.soundMsg);
fillSoundSelect(els.soundOther);

function previewSound(sel) {
  window.CPC_Sounds.preview(sel.value, Number(els.soundVolume.value), soundFile);
}
els.playMsg.addEventListener('click', () => previewSound(els.soundMsg));
els.playOther.addEventListener('click', () => previewSound(els.soundOther));
// Ao soltar o controle de volume, toca uma amostra (feedback imediato).
els.soundVolume.addEventListener('change', () => previewSound(els.soundMsg));
[els.soundMsg, els.soundOther].forEach((sel) => sel.addEventListener('change', () => previewSound(sel)));

let soundStatusId = null;
function soundStatusMsg(msg, ok = true) {
  els.soundStatus.textContent = msg;
  els.soundStatus.className = 'status ' + (ok ? 'ok' : 'err');
  clearTimeout(soundStatusId);
  soundStatusId = setTimeout(() => { els.soundStatus.textContent = ''; }, 4000);
}

els.soundFileBtn.addEventListener('click', () => els.soundFileInput.click());
els.soundFileInput.addEventListener('change', () => {
  const f = els.soundFileInput.files[0];
  els.soundFileInput.value = '';
  if (!f) return;
  if (!f.type.startsWith('audio/')) return soundStatusMsg('Escolha um arquivo de áudio.', false);
  if (f.size > 500 * 1024) return soundStatusMsg('Arquivo grande demais (máx. 500 KB).', false);
  const r = new FileReader();
  r.onload = () => {
    soundFile = String(r.result);
    soundFileName = f.name;
    // Se ainda ninguém usa "Meu arquivo", sugere para "Nova mensagem".
    if (els.soundMsg.value === 'padrao') els.soundMsg.value = 'arquivo';
    save();
    window.CPC_Sounds.preview('arquivo', Number(els.soundVolume.value), soundFile);
    soundStatusMsg('Arquivo carregado.');
  };
  r.onerror = () => soundStatusMsg('Não consegui ler o arquivo.', false);
  r.readAsDataURL(f);
});
els.soundFileClear.addEventListener('click', () => {
  soundFile = ''; soundFileName = '';
  if (els.soundMsg.value === 'arquivo') els.soundMsg.value = 'padrao';
  if (els.soundOther.value === 'arquivo') els.soundOther.value = 'padrao';
  save();
  soundStatusMsg('Arquivo removido.');
});


// ---------- aviso de nova versão (GitHub Releases) ----------
// Consulta a última release do repositório (no máx. 1x a cada 6 h) e compara com o manifest.
const REPO = 'devRenatoAlves/personalize-sendi';
const newer = (a, b) => {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
};
async function checkUpdate() {
  try {
    const current = chrome.runtime.getManifest?.().version;
    if (!current) return;
    const { cpc_update } = await chrome.storage.local.get('cpc_update');
    let info = cpc_update;
    if (!info || Date.now() - info.t > 6 * 3600 * 1000) {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (!res.ok) return;
      const rel = await res.json();
      info = { t: Date.now(), tag: rel.tag_name, url: rel.html_url };
      await chrome.storage.local.set({ cpc_update: info });
    }
    if (info.tag && newer(info.tag, current)) {
      const a = document.getElementById('updateBanner');
      a.href = info.url;
      document.getElementById('updateText').textContent = `Nova versão ${info.tag.replace(/^v/, '')} disponível`;
      a.title = `Você está na ${current}`;
      a.hidden = false;
    }
  } catch { /* sem rede ou limite da API: sem aviso */ }
}
checkUpdate();
