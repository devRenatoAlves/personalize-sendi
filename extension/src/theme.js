// Aplica tema/personalização visual no Sendi.
// O Sendi usa tokens de cor (variáveis CSS do shadcn: --background, --primary, --sidebar...),
// então a paleta é aplicada sobrescrevendo essas variáveis em :root e .dark — vale para o
// app inteiro e sobrevive aos re-renders, sem depender de classes do build.
// O papel de parede vai na área de mensagens (seletor estável em CPC_SELECTORS.chatBg).
window.CPC_Theme = (function () {
  const STYLE_ID = 'cpc-theme-style';
  const COLOR_ID = 'cpc-color-style';
  const GLASS_ID = 'cpc-glass-style';
  let observer = null;
  let debounceId = null;
  let current = { enabled: false, bgImage: '', accent: '', overlay: 0.4, autoColors: true, paletteHeader: '', paletteSide: '' };
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

  const luma = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  const hexOf = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

  // Papéis de cor → tokens do Sendi:
  //   header    → --primary/--ring (botões, itens ativos, marca)
  //   side      → --background/--sidebar/--card/--popover (as "molduras" e painéis)
  //   input     → tom de `side` deslocado: --muted/--input/--accent/--secondary (campos, hover)
  //   bubbleOut → balões enviados; bubbleIn → balões recebidos
  // O texto (--foreground etc.) é escolhido pela luminância de `side`, então qualquer paleta
  // fica legível, clara ou escura.
  function applyColors() {
    if (!colorCss) return;
    const side = parseRgb(colorCss.side), head = parseRgb(colorCss.header);
    const bo = parseRgb(colorCss.bubbleOut), bi = parseRgb(colorCss.bubbleIn);
    if (!side || !head) return;
    const dark = luma(side) < 0.5;
    const fg = dark ? '#f1f5f9' : '#0f172a';
    const fgMuted = dark ? '#94a3b8' : '#475569';
    const input = hexOf(parseRgb(surfaceTone(colorCss.side)));
    const border = hexOf(shade(side, dark ? 0.18 : -0.14));
    const sideDeep = hexOf(shade(side, dark ? -0.35 : -0.04));
    const onPrimary = luma(head) < 0.6 ? '#ffffff' : '#0f172a';
    const onBubble = (c) => (c && luma(c) < 0.6 ? '#ffffff' : '#0f172a');
    const primarySoft = hexOf(shade(head, dark ? -0.6 : 0.85));
    const vars = {
      '--background': hexOf(side), '--card': hexOf(side), '--popover': hexOf(side),
      '--sidebar': sideDeep, '--sidebar-background': sideDeep,
      '--foreground': fg, '--accent-foreground': fg, '--secondary-foreground': fg, '--card-foreground': fg, '--popover-foreground': fg,
      '--sidebar-foreground': fg, '--muted-foreground': fgMuted,
      '--muted': input, '--secondary': input, '--accent': input, '--sidebar-accent': input,
      '--input': border, '--border': border, '--sidebar-border': border,
      '--primary': hexOf(head), '--primary-foreground': onPrimary, '--ring': hexOf(head),
      '--sidebar-primary': hexOf(head), '--sidebar-primary-foreground': onPrimary,
      '--primary-soft': primarySoft, '--primary-soft-foreground': dark ? '#ffffff' : hexOf(head),
    };
    // Componentes do app com variantes `dark:` (ex.: avisos verdes) só ficam legíveis se o
    // <html> tiver a classe .dark. Ligamos conforme a paleta e devolvemos o estado original ao sair.
    syncDarkClass(dark);
    const decl = Object.entries(vars).map(([k, v]) => `${k}: ${v} !important;`).join(' ');
    const S = window.CPC_SELECTORS;
    if (current.glass && current.bgImage) setTimeout(applyGlass, 0);
    styleTag(COLOR_ID).textContent = `
      :root, html.dark, html.theme-light, html.app-shell { ${decl} }
      ${S.message}.justify-start > div[class*="rounded-xl"] { background-color: ${colorCss.bubbleIn} !important; color: ${onBubble(bi)} !important; }
      ${S.message}.justify-end > div[class*="rounded-xl"] { background-color: ${colorCss.bubbleOut} !important; color: ${onBubble(bo)} !important; }`;
  }

  // Guarda se o app já estava em .dark antes de mexermos, para restaurar ao desligar o tema.
  function syncDarkClass(wantDark) {
    const root = document.documentElement;
    if (root.dataset.cpcDarkOrig === undefined) root.dataset.cpcDarkOrig = root.classList.contains('dark') ? '1' : '0';
    root.classList.toggle('dark', wantDark);
  }
  function restoreDarkClass() {
    const root = document.documentElement;
    if (root.dataset.cpcDarkOrig === undefined) return;
    root.classList.toggle('dark', root.dataset.cpcDarkOrig === '1');
    delete root.dataset.cpcDarkOrig;
  }

  function clearColors() {
    restoreDarkClass();
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

  // Modo vidro (liquid glass): o papel de parede cobre a tela inteira e os painéis com
  // informação (lista de conversas, cabeçalhos, barra de resposta, balões, menus) ficam
  // translúcidos com desfoque do fundo. A área das mensagens fica transparente.
  function applyGlass() {
    const op = Math.max(10, Math.min(95, current.glassOpacity));
    const blur = Math.max(0, Math.min(40, current.glassBlur));
    const dim = Math.max(0, Math.min(1, current.overlay));
    const S = window.CPC_SELECTORS;
    const tint = (v, a = op) => `color-mix(in srgb, var(${v}) ${a}%, transparent)`;
    const glass = `backdrop-filter: blur(${blur}px) saturate(1.5) !important; -webkit-backdrop-filter: blur(${blur}px) saturate(1.5) !important;`;
    const bubbleOut = colorCss ? colorCss.bubbleOut : 'oklch(0.508 0.118 165.612)';
    const bubbleIn = colorCss ? colorCss.bubbleIn : null;
    const wrap = '[class~="group/sidebar-wrapper"]';
    styleTag(GLASS_ID).textContent = `
      ${wrap} {
        background-color: transparent !important;
        background-image: linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${cssUrl(current.bgImage)}") !important;
        background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important;
      }
      main.bg-background, main[class~="bg-background"] { background: transparent !important; }
      ${wrap} .bg-sidebar, ${wrap} > div.peer > div > div {
        background-color: ${tint('--sidebar-background')} !important; ${glass}
      }
      main > header, main aside, ${S.chatHeader}, ${S.chatSection} > div.border-b,
      footer[data-slot="composer"] {
        background-color: ${tint('--background')} !important; ${glass}
      }
      ${S.message}.justify-start > div[class*="rounded-xl"] {
        background-color: ${bubbleIn ? `color-mix(in srgb, ${bubbleIn} ${Math.min(95, op + 25)}%, transparent)` : tint('--muted', Math.min(95, op + 25))} !important; ${glass}
      }
      ${S.message}.justify-end > div[class*="rounded-xl"] {
        background-color: color-mix(in srgb, ${bubbleOut} ${Math.min(95, op + 35)}%, transparent) !important; ${glass}
      }
      [data-slot="popover-content"], [data-slot="dropdown-menu-sub-content"], [role="dialog"] {
        background-color: ${tint('--popover', Math.min(95, op + 30))} !important; ${glass}
      }
      /* Menu com submenu: backdrop-filter no pai vira "containing block" do submenu (position:fixed)
         e o overflow do menu o corta. Sem blur aqui, com fundo quase opaco para o texto de trás não vazar. */
      [data-slot="dropdown-menu-content"] {
        background-color: ${tint('--popover', 97)} !important;
      }`;
  }
  function clearGlass() {
    const s = document.getElementById(GLASS_ID);
    if (s) s.textContent = '';
  }

  // Papel de parede na área de mensagens. O seletor é estável, então vai direto em CSS
  // (sem marcar elementos nem observar o DOM).
  function applyChatBg() {
    if (!current.enabled || !current.bgImage) return;
    const a = Math.max(0, Math.min(1, current.overlay));
    const overlay = `linear-gradient(rgba(0,0,0,${a}), rgba(0,0,0,${a}))`;
    styleEl().textContent = `
      ${window.CPC_SELECTORS.chatBg} {
        background-image: ${overlay}, url("${cssUrl(current.bgImage)}") !important;
        background-size: cover !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
      }`;
  }

  function clearChatBg() {
    const s = document.getElementById(STYLE_ID);
    if (s) s.textContent = '';
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
      glass: !!prefs.glassMode,
      glassOpacity: typeof prefs.glassOpacity === 'number' ? prefs.glassOpacity : 45,
      glassBlur: typeof prefs.glassBlur === 'number' ? prefs.glassBlur : 16,
      dockColor: prefs.dockColor || '',
    };

    // Cor dos balões flutuantes (dock) — independe do tema estar ligado.
    if (current.dockColor) {
      root.style.setProperty('--cpc-dock-bg', current.dockColor);
    } else {
      root.style.removeProperty('--cpc-dock-bg');
    }

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

    // Paleta manual (popup) funciona sozinha, com ou sem imagem. Sem paleta manual,
    // as cores vêm da imagem de fundo (se "cores automáticas" estiver ligado).
    const manual = paletteFromColors(current.paletteHeader, current.paletteSide,
      current.paletteBubbleOut, current.paletteBubbleIn);

    if (!current.enabled) {
      clearChatBg();
      clearGlass();
      clearColors();
      return;
    }

    const glassOn = current.glass && !!current.bgImage;
    if (current.bgImage && !glassOn) applyChatBg(); else clearChatBg();

    if (glassOn) applyGlass(); else clearGlass();

    if (manual) {
      colorCss = manual;
      lastColorUrl = null; // próxima extração de imagem não reusa cache da cor manual
      applyColors();
    } else if (current.bgImage && current.autoColors) {
      if (lastColorUrl === current.bgImage && colorCss) {
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
  }

  return { apply };
})();
