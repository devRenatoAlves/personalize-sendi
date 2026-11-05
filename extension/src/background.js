// Service worker: extrai cores dominantes de uma imagem.
// Roda no background (com host_permissions) → lê os bytes ignorando o CORS da página.
// Configuração abre num painel lateral (não fecha ao abrir o seletor de arquivos, ao contrário do popup).
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
} else if (chrome.action && chrome.action.onClicked) {
  // Sem painel lateral (ex.: Firefox): abre a mesma tela numa aba.
  chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html?panel') }));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'cpc-extract') return;
  extractColors(msg.url).then(sendResponse);
  return true; // resposta assíncrona
});

const rgb = (c) => `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`;
const mix = (c, t, a) => ({ r: c.r + (t.r - c.r) * a, g: c.g + (t.g - c.g) * a, b: c.b + (t.b - c.b) * a });
const sat = (c) => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx === 0 ? 0 : (mx - mn) / mx; };
const BLACK = { r: 0, g: 0, b: 0 };

async function extractColors(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { error: 'http ' + res.status };
    const blob = await res.blob();
    const bmp = await createImageBitmap(blob);
    const w = 64;
    const h = Math.max(1, Math.round((64 * bmp.height) / bmp.width));
    const cv = new OffscreenCanvas(w, h);
    const ctx = cv.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const buckets = {};
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const light = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
      if (light < 25 || light > 235) continue;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      const bk = buckets[key] || (buckets[key] = { r: 0, g: 0, b: 0, n: 0 });
      bk.r += r; bk.g += g; bk.b += b; bk.n++;
    }
    const arr = Object.values(buckets).map((bk) => ({ r: bk.r / bk.n, g: bk.g / bk.n, b: bk.b / bk.n, n: bk.n }));
    if (!arr.length) return { error: 'sem cor' };

    const vib = arr.reduce((a, b) => (b.n * sat(b) > a.n * sat(a) ? b : a));
    const dom = arr.reduce((a, b) => (b.n > a.n ? b : a));
    return {
      header: rgb(mix(vib, BLACK, 0.4)),    // vibrante escurecido
      side: rgb(mix(dom, BLACK, 0.8)),      // dominante bem escuro
      bubbleOut: rgb(mix(vib, BLACK, 0.45)), // enviadas: vibrante médio (mais claro)
      bubbleIn: rgb(mix(dom, BLACK, 0.72)),  // recebidas: dominante escuro
    };
  } catch (e) {
    return { error: String(e) };
  }
}
