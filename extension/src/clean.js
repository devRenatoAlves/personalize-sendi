// Modo clean: esconde a barra lateral do app e o cabeçalho, deixando só a lista de
// atendimentos (esquerda) e a conversa (direita, ocupando o resto) — pensado para telas
// pequenas. O visual é todo CSS em styles.css, atrás da classe html.cpc-clean.
// Liga/desliga pelo popup da extensão ou pelo botão flutuante na tela (cpc-clean-toggle).
window.CPC_Clean = (function () {
  const CLS = 'cpc-clean';
  const BTN_ID = 'cpc-clean-toggle';
  let on = false;

  function paint() {
    document.documentElement.classList.toggle(CLS, on);
    let b = document.getElementById(BTN_ID);
    if (!b) {
      b = document.createElement('button');
      b.id = BTN_ID;
      b.type = 'button';
      b.addEventListener('click', async () => {
        await window.CPC_store.setPrefs({ cleanMode: !on });
      });
      document.body.appendChild(b);
    }
    b.innerHTML = window.CPC_icon(on ? 'minimize-2' : 'maximize-2', 14);
    b.title = on ? 'Sair do modo clean (voltar à interface completa)' : 'Modo clean: esconde menus e deixa só atendimentos + conversa';
    b.classList.toggle('cpc-on', on);
  }

  async function apply() {
    const p = await window.CPC_store.getPrefs();
    on = !!p.cleanMode;
    paint();
  }

  // O Vue pode remontar o body em navegações: garante que o botão continue lá.
  function refresh() {
    if (!document.getElementById(BTN_ID)) paint();
  }

  return { apply, refresh };
})();
