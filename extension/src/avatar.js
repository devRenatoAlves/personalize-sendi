// Foto de perfil ampliada: clicar no círculo do cabeçalho da conversa abre um visualizador.
// O Sendi só guarda a foto em 96x96, então a versão "melhorada" é reamostrada no navegador
// (Lanczos-3 para 6x + máscara de nitidez leve). Não ganha detalhe real; só fica menos
// quadriculada que a ampliação padrão do navegador. "Original" mostra a miniatura crua.
window.CPC_Avatar = (function () {
  const S = window.CPC_SELECTORS;
  const SCALE = 6;
  let enabled = true;

  async function reload() {
    const p = await window.CPC_store.getPrefs();
    enabled = p.avatarZoom !== false;
  }

  // ---- reamostragem Lanczos-3 (separável: horizontal, depois vertical) ----
  const lanczos = (x) => {
    if (x === 0) return 1;
    if (x <= -3 || x >= 3) return 0;
    const px = Math.PI * x;
    return (3 * Math.sin(px) * Math.sin(px / 3)) / (px * px);
  };

  function resample1D(src, sw, sh, dw, dh, horizontal) {
    const out = new Float32Array(dw * dh * 4);
    const ratio = horizontal ? sw / dw : sh / dh;
    const scale = Math.max(1, ratio); // só reduz o filtro ao diminuir; ao ampliar usa o kernel normal
    const n = horizontal ? dw : dh;
    for (let i = 0; i < n; i++) {
      const center = (i + 0.5) * ratio - 0.5;
      const first = Math.floor(center - 3 * scale), last = Math.ceil(center + 3 * scale);
      const w = [], idx = [];
      let sum = 0;
      for (let k = first; k <= last; k++) {
        const wt = lanczos((k - center) / scale);
        if (!wt) continue;
        const kk = Math.min((horizontal ? sw : sh) - 1, Math.max(0, k));
        w.push(wt); idx.push(kk); sum += wt;
      }
      const lines = horizontal ? dh : dw;
      for (let l = 0; l < lines; l++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let j = 0; j < w.length; j++) {
          const o = horizontal ? (l * sw + idx[j]) * 4 : (idx[j] * sw + l) * 4;
          const wt = w[j] / sum;
          r += src[o] * wt; g += src[o + 1] * wt; b += src[o + 2] * wt; a += src[o + 3] * wt;
        }
        const d = horizontal ? (l * dw + i) * 4 : (i * dw + l) * 4;
        out[d] = r; out[d + 1] = g; out[d + 2] = b; out[d + 3] = a;
      }
    }
    return out;
  }

  // Desfoque gaussiano simples (caixa 3x) para a máscara de nitidez.
  function boxBlur(src, w, h, r) {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    const pass = (a, b, horiz) => {
      const len = horiz ? w : h, lines = horiz ? h : w, div = 2 * r + 1;
      for (let l = 0; l < lines; l++) {
        for (let c = 0; c < 3; c++) {
          let acc = 0;
          const at = (i) => (horiz ? (l * w + Math.min(len - 1, Math.max(0, i))) : (Math.min(len - 1, Math.max(0, i)) * w + l)) * 4 + c;
          for (let i = -r; i <= r; i++) acc += a[at(i)];
          for (let i = 0; i < len; i++) {
            const o = (horiz ? (l * w + i) : (i * w + l)) * 4 + c;
            b[o] = acc / div;
            acc += a[at(i + r + 1)] - a[at(i - r)];
          }
        }
      }
    };
    pass(src, tmp, true); pass(tmp, out, false);
    return out;
  }

  function enhance(img) {
    const sw = img.naturalWidth, sh = img.naturalHeight;
    const dw = sw * SCALE, dh = sh * SCALE;
    const c0 = document.createElement('canvas');
    c0.width = sw; c0.height = sh;
    const x0 = c0.getContext('2d');
    x0.drawImage(img, 0, 0);
    const src = x0.getImageData(0, 0, sw, sh).data;
    const horiz = resample1D(src, sw, sh, dw, sh, true);
    let px = resample1D(horiz, dw, sh, dw, dh, false);

    // Máscara de nitidez: original + amount * (original - desfocado), só onde o contraste passa do limiar.
    let blur = boxBlur(px, dw, dh, SCALE);
    blur = boxBlur(blur, dw, dh, SCALE);
    const amount = 0.7, thr = 3;
    const out = new Uint8ClampedArray(dw * dh * 4);
    for (let i = 0; i < px.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const d = px[i + c] - blur[i + c];
        out[i + c] = Math.abs(d) > thr ? px[i + c] + amount * d : px[i + c];
      }
      out[i + 3] = 255;
    }
    const c1 = document.createElement('canvas');
    c1.width = dw; c1.height = dh;
    c1.getContext('2d').putImageData(new ImageData(out, dw, dh), 0, 0);
    return c1;
  }

  // ---- visualizador ----
  function close() { document.getElementById('cpc-avatar-view')?.remove(); document.removeEventListener('keydown', onKey, true); }
  function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }

  function open(img) {
    close();
    const name = document.querySelector(S.contactName)?.textContent?.trim() || '';
    const view = document.createElement('div');
    view.id = 'cpc-avatar-view';
    view.innerHTML = `
      <div class="cpc-av-card" role="dialog" aria-label="Foto do contato">
        <canvas class="cpc-av-img"></canvas>
        <div class="cpc-av-name"></div>
        <div class="cpc-av-bar">
          <button type="button" data-m="enh" class="cpc-active">✨ Melhorada</button>
          <button type="button" data-m="raw">Original (96px)</button>
          <button type="button" data-act="save">⬇ Salvar</button>
          <button type="button" data-act="close">Fechar</button>
        </div>
        <div class="cpc-av-note">O Sendi guarda esta foto em ${img.naturalWidth}×${img.naturalHeight}. A melhoria suaviza a ampliação, mas não cria detalhe real.</div>
      </div>`;
    view.querySelector('.cpc-av-name').textContent = name;
    document.body.appendChild(view);
    document.addEventListener('keydown', onKey, true);

    const canvas = view.querySelector('canvas');
    const enhanced = enhance(img);
    let mode = 'enh';
    function paint() {
      const src = mode === 'enh' ? enhanced : img;
      canvas.width = enhanced.width; canvas.height = enhanced.height;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false; // "Original" = pixels crus, como a miniatura é de fato
      ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
      view.querySelectorAll('[data-m]').forEach((b) => b.classList.toggle('cpc-active', b.dataset.m === mode));
    }
    paint();

    view.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b?.dataset.m) { mode = b.dataset.m; paint(); return; }
      if (b?.dataset.act === 'save') {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = (name.replace(/[^\w.-]+/g, '_') || 'contato') + (mode === 'enh' ? '-ampliada.png' : '-original.png');
        a.click();
        return;
      }
      if (b?.dataset.act === 'close' || e.target === view) close();
    });
  }

  // Captura o clique no círculo da foto (só o avatar, não o nome) antes do Sendi abrir o painel.
  function onClick(e) {
    if (!enabled) return;
    const av = e.target.closest?.(S.headerAvatar);
    if (!av) return;
    const img = av.querySelector('img');
    if (!img || !img.naturalWidth) return; // sem foto (iniciais): deixa o Sendi tratar
    e.preventDefault(); e.stopPropagation();
    open(img);
  }

  async function init() {
    await reload();
    document.addEventListener('click', onClick, true);
    chrome.storage.onChanged.addListener((c) => { if (c.cpc_prefs) reload(); });
  }

  return { init, enhance };
})();
