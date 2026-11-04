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

function refreshUI() {
  els.themeOpts.classList.toggle('disabled', !els.themeEnabled.checked);
  els.reasonOpts.classList.toggle('disabled', !els.aiReason.checked);
  els.reasonCopy.classList.toggle('active', reasonAction === 'copy');
  els.reasonFinish.classList.toggle('active', reasonAction === 'finalize');
  [els.overlay, els.glassOpacity, els.glassBlur].forEach((r) => {
    r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min)) * 100 + '%');
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
    clientLink: els.clientLink.checked,
    clientLinkDomain: els.clientLinkDomain.value.trim(),
    dockColor: dockManual ? els.dockColor.value : '',
  };
  await chrome.storage.local.set({ cpc_prefs });
  refreshUI();
}

['themeEnabled', 'bgImage', 'overlay', 'glassMode', 'glassOpacity', 'glassBlur', 'autoColors',
 'aiUrl', 'aiToken', 'aiImprove', 'aiSuggest', 'aiReason', 'clientLink', 'clientLinkDomain', 'cleanMode'].forEach((k) => {
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
