// Aplica tema/personalização visual.
// O Sendi é SPA com painéis opacos: o fundo do body só aparece na faixa lateral.
// O padrão de rabiscos do chat costuma vir de um pseudo-elemento (::before).
// Detectamos o maior elemento (ou seu pseudo) que tem background-image e
// substituímos por um stylesheet injetado — sem depender de classes do build.
window.CPC_Theme = (function () {
  const STYLE_ID = 'cpc-theme-style';
  const COLOR_ID = 'cpc-color-style';
  const LOGO_ID = 'cpc-logo-style';
  let observer = null;
  let debounceId = null;
  let current = { enabled: false, bgImage: '', accent: '', overlay: 0.4, autoColors: true, paletteHeader: '', paletteSide: '', logoImage: '', logoRound: false };
  let colorCss = null;      // { header, side } já calculados
  let lastColorUrl = null;  // cache: evita reextrair a mesma imagem

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  const rgbStr = (c) => `rgb(${c.r},${c.g},${c.b})`;

  // Tom de "superfície" (inputs, cards) derivado da cor base: clareia se a base for
  // escura, escurece se for clara — assim o campo destaca-se do painel sem virar
  // outra cor. Aceita "rgb(r,g,b)" (formato já usado em colorCss).
  function parseRgb(str) {
    const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(str || '');
    return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
  }
  function shade(c, amt) {
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return {
      r: Math.round(c.r + (t - c.r) * p),
      g: Math.round(c.g + (t - c.g) * p),
      b: Math.round(c.b + (t - c.b) * p),
    };
  }
  function surfaceTone(baseStr) {
    const c = parseRgb(baseStr);
    if (!c) return baseStr;
    const lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    return rgbStr(shade(c, lum < 0.5 ? 0.12 : -0.1));
  }

  // Paleta manual do popup (cores EXATAS, sem derivar — pra obedecer a escolha).
  // header = header/botões; side = restante/inputs. Balões opcionais: se vazios,
  // herdam header (enviado) e side (recebido).
  function paletteFromColors(headerHex, sideHex, bubbleOutHex, bubbleInHex) {
    const h = hexToRgb(headerHex), s = hexToRgb(sideHex);
    if (!h || !s) return null;
    const H = rgbStr(h), S = rgbStr(s);
    const bo = hexToRgb(bubbleOutHex), bi = hexToRgb(bubbleInHex);
    return {
      header: H,
      side: S,
      bubbleOut: bo ? rgbStr(bo) : H,
      bubbleIn: bi ? rgbStr(bi) : S,
    };
  }

  function styleTag(id) {
    let s = document.getElementById(id);
    if (!s) {
      s = document.createElement('style');
      s.id = id;
      document.head.appendChild(s);
    }
    return s;
  }
  const styleEl = () => styleTag(STYLE_ID);

  // Extração de cores delegada ao service worker (busca os bytes ignorando CORS).
  function extractColors(url) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'cpc-extract', url }, (resp) => {
        if (chrome.runtime.lastError || !resp || resp.error) return resolve(null);
        resolve(resp); // { header, side }
      });
    });
  }

  function applyColors() {
    if (!colorCss) return;
    // Papéis de cor (divisão clara e harmônica):
    //   header   → barra do topo + botões de ação (cor da marca)
    //   side     → painéis: navs, listas, rodapé, aside, relatórios (a "moldura")
    //   input    → campos digitáveis e cards de superfície — tom de `side` deslocado,
    //              destaca-se do painel sem copiar a cor do balão recebido
    //   bubbleIn → SÓ balões recebidos (e avisos do chat)
    //   bubbleOut→ balões enviados (e botão secundário)
    const input = surfaceTone(colorCss.side);
    styleTag(COLOR_ID).textContent = `
      section.header { background-color: ${colorCss.header} !important; background-image: none !important; }
      header,
      .chat-sessions,
      .session-search,
      .session-groups,
      .left-nav,
      .left-nav-top,
      .left-nav-bottom,
      footer.chat-messages-footer,
      .chat-messages-footer-assigned,
      main.reports,
      aside.reports-aside,
      section.reports-content,
      .rep-topics,
      .rep-content-flex,
      .session-filters,
      .subnav,
      .subnav-search,
      .subnav-list,
      .chat-messages-shortcuts { background-color: ${colorCss.side} !important; }

      /* Itens do dropdown de mensagens rápidas: transparentes (mostram o painel),
         realçam no hover com o tom de superfície */
      .chat-messages-shortcuts a { background-color: transparent !important; }
      .chat-messages-shortcuts a:hover { background-color: ${input} !important; }

      .chat-aside,
      .chat-aside-header,
      .chat-aside-article,
      .lead-header,
      .lead-form { background-color: ${colorCss.side} !important; background-image: none !important; }

      /* Campos digitáveis: busca, filtros e o compositor de mensagem */
      .session-search .input,
      .session-search .input-field,
      .session-search .input-field-inner,
      .session-search input,
      .session-filters .input,
      .session-filters .input-field,
      .session-filters .input-field-inner,
      .session-filters .input-field input,
      .session-filters .input-field select,
      .subnav-search .input,
      .subnav-search .input-field,
      .subnav-search .input-field-inner,
      .subnav-search .input-field-inner input,
      .chat-messages-footer__text,
      .chat-messages-footer__text .input-masked,
      .chat-messages-footer__text .input-masked textarea { background-color: ${input} !important; }

      /* Cards de métrica dos relatórios: superfície (não balão) */
      .rep-topics-item,
      .rep-topics-item--red,
      .rep-topics-item--blue,
      .rep-topics-item--green,
      .rep-topics-item .rep-topics-header { background-color: ${input} !important; background-image: none !important; }

      .msg:not(.msg--from-me) .msg-container { background-color: ${colorCss.bubbleIn} !important; }
      .msg--from-me .msg-container { background-color: ${colorCss.bubbleOut} !important; }

      /* Player de áudio: a barra de controles nativa tem fundo escuro próprio —
         pinta com a cor do balão (enviado/recebido) */
      .msg--from-me .msg-audio audio,
      .msg--from-me .msg-audio audio::-webkit-media-controls-panel,
      .msg--from-me .msg-audio audio::-webkit-media-controls-enclosure { background-color: ${colorCss.bubbleOut} !important; }
      .msg:not(.msg--from-me) .msg-audio audio,
      .msg:not(.msg--from-me) .msg-audio audio::-webkit-media-controls-panel,
      .msg:not(.msg--from-me) .msg-audio audio::-webkit-media-controls-enclosure { background-color: ${colorCss.bubbleIn} !important; }
      .msg-notice,
      .msg-resume { background-color: ${colorCss.bubbleIn} !important; }

      .chat-messages-footer-assigned .button { background-color: ${colorCss.header} !important; border-color: ${colorCss.header} !important; }
      .chat-messages-footer-assigned .button.button-alt { background-color: ${colorCss.bubbleOut} !important; border-color: ${colorCss.bubbleOut} !important; }`;
  }

  function clearColors() {
    const s = document.getElementById(COLOR_ID);
    if (s) s.textContent = '';
    colorCss = null;
    lastColorUrl = null;
  }

  // URL que entra em url("..."): escapa aspas, parênteses, barra invertida e espaços
  // para ninguém escapar da regra CSS (as prefs podem vir de um backup JSON importado).
  function cssUrl(u) {
    // %-escapa na mão: encodeURIComponent deixa passar ( ) ' — justo o que precisa sumir.
    const clean = String(u || '').trim()
      .replace(/["'()\\\s]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'));
    return /^javascript:/i.test(clean) ? '' : clean;
  }

  // Logo personalizada: esconde o <img> original e pinta a imagem nova como background
  // da âncora. CSS puro = sobrevive aos re-renders do React sem reaplicar em cada mutação.
  // O <img> fica com opacity:0 (não display:none) para a âncora manter o tamanho original.
  function applyLogo() {
    if (!current.logoImage) return;
    const sel = window.CPC_SELECTORS.headerLogo;
    // Redonda: caixa quadrada recortada em círculo (cover). Normal: retangular (contain).
    const shape = current.logoRound
      ? `width: 32px !important; height: 32px !important; border-radius: 50% !important;
         background-size: cover !important;`
      : `background-size: contain !important;`;
    styleTag(LOGO_ID).textContent = `
      ${sel} img { opacity: 0 !important; }
      ${sel} {
        background-image: url("${cssUrl(current.logoImage)}") !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        ${shape}
      }`;
  }

  function clearLogo() {
    const s = document.getElementById(LOGO_ID);
    if (s) s.textContent = '';
  }

  // Qual camada do elemento tem o background-image: '' (próprio), '::before' ou '::after'.
  function bgLayer(el) {
    for (const layer of ['', '::before', '::after']) {
      const bg = getComputedStyle(el, layer || null).backgroundImage;
      if (bg && bg !== 'none' && bg.indexOf('url(') !== -1) return layer;
    }
    return null;
  }

  // Acha o maior painel (qualquer tag) cujo próprio ou pseudo tem background-image.
  function findChatBg() {
    const marked = document.querySelector('[data-cpc-bg="1"]');
    if (marked) {
      const r = marked.getBoundingClientRect();
      const layer = bgLayer(marked);
      // Reusa só se ainda estiver visível (a tela inicial vira hidden ao abrir conversa).
      if (r.width > 0 && r.height > 0 && layer !== null) return { el: marked, layer };
      delete marked.dataset.cpcBg;
      delete marked.dataset.cpcLayer;
    }

    // 1) Alvo conhecido: painel de rabiscos da conversa (classe estável).
    for (const el of document.querySelectorAll(window.CPC_SELECTORS.chatBg)) {
      const r = el.getBoundingClientRect();
      if (r.width < 50 || r.height < 50) continue; // ignora versões ocultas (print/preview)
      const layer = bgLayer(el);
      if (layer !== null) return { el, layer };
    }

    // 2) Fallback heurístico (ex.: tela inicial, que é outro elemento).
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let best = null;
    let maxArea = 0;
    document.querySelectorAll('div, section, main, ul, article').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < vw * 0.3 || r.height < vh * 0.3) return; // só painéis grandes
      if (r.left > vw * 0.5) return; // ignora popups/listas à direita
      const layer = bgLayer(el);
      if (layer === null) return;
      const area = r.width * r.height;
      if (area > maxArea) { maxArea = area; best = { el, layer }; }
    });
    return best;
  }

  function applyChatBg() {
    if (!current.enabled || !current.bgImage) return;
    const found = findChatBg();
    if (!found) return;
    found.el.dataset.cpcBg = '1';
    found.el.dataset.cpcLayer = found.layer;

    const a = Math.max(0, Math.min(1, current.overlay));
    const overlay = `linear-gradient(rgba(0,0,0,${a}), rgba(0,0,0,${a}))`;
    const sel = `[data-cpc-bg="1"]${found.layer}`;
    styleEl().textContent = `
      ${sel} {
        background-image: ${overlay}, url("${cssUrl(current.bgImage)}") !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
      }`;

    if (current.autoColors && colorCss) applyColors(); // re-marca header em re-renders
  }

  function clearChatBg() {
    const s = document.getElementById(STYLE_ID);
    if (s) s.textContent = '';
    document.querySelectorAll('[data-cpc-bg="1"]').forEach((el) => {
      delete el.dataset.cpcBg;
      delete el.dataset.cpcLayer;
    });
  }

  function startObserver() {
    if (observer) return;
    // Throttle (não-reset): aplica a cada ~250ms mesmo com mensagens entrando em rajada.
    let pending = false;
    observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      debounceId = setTimeout(() => { pending = false; applyChatBg(); }, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  function stopObserver() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  async function apply() {
    const prefs = await window.CPC_store.getPrefs();
    const root = document.documentElement;

    current = {
      enabled: !!prefs.themeEnabled,
      bgImage: prefs.bgImage || '',
      accent: prefs.accent || '',
      overlay: typeof prefs.overlay === 'number' ? prefs.overlay : 0.4,
      autoColors: prefs.autoColors !== false,
      paletteHeader: prefs.paletteHeader || '',
      paletteSide: prefs.paletteSide || '',
      paletteBubbleOut: prefs.paletteBubbleOut || '',
      paletteBubbleIn: prefs.paletteBubbleIn || '',
      logoImage: prefs.logoImage || '',
      logoRound: !!prefs.logoRound,
      dockColor: prefs.dockColor || '',
    };

    // Cor dos balões flutuantes (dock) — independe do tema estar ligado.
    if (current.dockColor) {
      root.style.setProperty('--cpc-dock-bg', current.dockColor);
    } else {
      root.style.removeProperty('--cpc-dock-bg');
    }

    // Logo personalizada: independe do papel de parede, só do tema estar ligado.
    if (current.enabled && current.logoImage) applyLogo();
    else clearLogo();

    root.classList.toggle('cpc-theme-on', current.enabled);
    if (current.enabled && current.bgImage) {
      root.style.setProperty('--cpc-bg-image', `url("${cssUrl(current.bgImage)}")`);
    } else {
      root.style.removeProperty('--cpc-bg-image');
    }
    if (current.enabled && current.accent) {
      root.style.setProperty('--cpc-accent', current.accent);
    } else {
      root.style.removeProperty('--cpc-accent');
    }
    root.classList.toggle('cpc-timer-off', !prefs.timerEnabled);

    if (current.enabled && current.bgImage) {
      applyChatBg();
      startObserver();

      // Cores automáticas: cor manual do popup sobrescreve a extração da imagem.
      if (current.autoColors) {
        const manual = paletteFromColors(current.paletteHeader, current.paletteSide,
          current.paletteBubbleOut, current.paletteBubbleIn);
        if (manual) {
          colorCss = manual;
          lastColorUrl = null; // próxima extração de imagem não reusa cache da cor manual
          applyColors();
        } else if (lastColorUrl === current.bgImage && colorCss) {
          applyColors();
        } else {
          const url = current.bgImage;
          extractColors(url).then((cols) => {
            if (!cols || current.bgImage !== url || !current.autoColors ||
                current.paletteHeader || current.paletteSide) return;
            colorCss = cols;
            lastColorUrl = url;
            applyColors();
          });
        }
      } else {
        clearColors();
      }
    } else {
      stopObserver();
      clearChatBg();
      clearColors();
    }
  }

  return { apply };
})();
