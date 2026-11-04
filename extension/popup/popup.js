// Lê e grava preferências em chrome.storage.local.
const DEFAULTS = {
  themeEnabled: false,
  bgImage: '',
  accent: '#2563eb',
  overlay: 0.4,
  autoColors: true,
  paletteHeader: '',
  paletteSide: '',
  paletteBubbleOut: '',
  paletteBubbleIn: '',
  logoImage: '',
  logoRound: false,
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
  accent: document.getElementById('accent'),
  overlay: document.getElementById('overlay'),
  overlayVal: document.getElementById('overlayVal'),
  autoColors: document.getElementById('autoColors'),
  paletteHeader: document.getElementById('paletteHeader'),
  paletteSide: document.getElementById('paletteSide'),
  paletteBubbleOut: document.getElementById('paletteBubbleOut'),
  paletteBubbleIn: document.getElementById('paletteBubbleIn'),
  paletteClear: document.getElementById('paletteClear'),
  paletteSub: document.getElementById('paletteSub'),
  logoImage: document.getElementById('logoImage'),
  logoRound: document.getElementById('logoRound'),
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

function refreshUI() {
  els.themeOpts.classList.toggle('disabled', !els.themeEnabled.checked);
  els.reasonOpts.classList.toggle('disabled', !els.aiReason.checked);
  els.reasonCopy.classList.toggle('active', reasonAction === 'copy');
  els.reasonFinish.classList.toggle('active', reasonAction === 'finalize');
  els.overlayVal.textContent = `${els.overlay.value}%`;
  els.paletteClear.classList.toggle('active', !paletteManual);
  els.paletteSub.textContent = paletteManual
    ? 'Paleta manual — sobrepõe as cores da imagem.'
    : 'Usando as cores da imagem.';
  els.dockColorAuto.classList.toggle('active', !dockManual);
  els.dockColorSub.textContent = dockManual
    ? 'Cor personalizada dos balões.'
    : 'Cor padrão (degradê).';
}

async function load() {
  const { cpc_prefs } = await chrome.storage.local.get('cpc_prefs');
  const prefs = Object.assign({}, DEFAULTS, cpc_prefs || {});
  els.themeEnabled.checked = !!prefs.themeEnabled;
  els.bgImage.value = prefs.bgImage || '';
  els.accent.value = prefs.accent || '#2563eb';
  els.overlay.value = Math.round((prefs.overlay ?? 0.4) * 100);
  els.autoColors.checked = prefs.autoColors !== false;
  paletteManual = !!(prefs.paletteHeader && prefs.paletteSide);
  if (prefs.paletteHeader) els.paletteHeader.value = prefs.paletteHeader;
  if (prefs.paletteSide) els.paletteSide.value = prefs.paletteSide;
  if (prefs.paletteBubbleOut) els.paletteBubbleOut.value = prefs.paletteBubbleOut;
  if (prefs.paletteBubbleIn) els.paletteBubbleIn.value = prefs.paletteBubbleIn;
  els.logoImage.value = prefs.logoImage || '';
  els.logoRound.checked = !!prefs.logoRound;
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
    accent: els.accent.value,
    overlay: Number(els.overlay.value) / 100,
    autoColors: els.autoColors.checked,
    paletteHeader: paletteManual ? els.paletteHeader.value : '',
    paletteSide: paletteManual ? els.paletteSide.value : '',
    paletteBubbleOut: paletteManual ? els.paletteBubbleOut.value : '',
    paletteBubbleIn: paletteManual ? els.paletteBubbleIn.value : '',
    logoImage: els.logoImage.value.trim(),
    logoRound: els.logoRound.checked,
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

['themeEnabled', 'bgImage', 'logoImage', 'logoRound', 'accent', 'overlay', 'autoColors',
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
  els.backupStatus.style.color = ok ? '#22c55e' : '#ef4444';
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
