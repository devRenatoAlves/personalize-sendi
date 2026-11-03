// Cole no Console (F12) do Sendi, com a tela de atendimento aberta.
// Gera um esqueleto do DOM (tags, classes, atributos estáveis, texto curto) e copia
// para a área de transferência, sem enviar nada para lugar nenhum. Texto de mensagens
// e nomes de clientes são cortados/mascarados, então dá para compartilhar.
(() => {
  const KEEP = ['id', 'role', 'type', 'href', 'aria-label', 'title', 'placeholder', 'data-testid', 'data-state', 'contenteditable'];
  const mask = (t) => t.replace(/\d/g, '#').slice(0, 24);
  const walk = (el, d) => {
    if (d > 14 || ['SCRIPT', 'STYLE', 'SVG', 'PATH', 'IMG'].includes(el.tagName.toUpperCase())) return '';
    const attrs = KEEP.filter((k) => el.hasAttribute(k)).map((k) => `${k}="${mask(el.getAttribute(k))}"`);
    const cls = el.getAttribute('class');
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ');
    const kids = [...el.children].map((c) => walk(c, d + 1)).join('');
    return `${'  '.repeat(d)}<${el.tagName.toLowerCase()}${cls ? ` class="${cls.slice(0, 120)}"` : ''}${attrs.length ? ' ' + attrs.join(' ') : ''}>${own ? ' «' + mask(own) + '»' : ''}\n${kids}`;
  };
  const out = walk(document.body, 0);
  copy(out);
  console.log(`DOM copiado (${out.length} caracteres). Cole no chat/arquivo.`);
})();
