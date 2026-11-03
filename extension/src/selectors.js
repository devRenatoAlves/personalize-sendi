// Camada central de seletores DOM.
// Único lugar a atualizar se o Sendi mudar o layout.
window.CPC_SELECTORS = {
  // Lista que contém os cards de atendimento.
  cardList: 'section.session-cards',

  // Cada card de atendimento (âncora com link para o chat).
  card: 'a.card[href^="/chat/"]',

  // Card atualmente aberto/ativo.
  cardActive: 'a.card--active',

  // Região interna onde injetamos o cronômetro.
  cardSlot: 'aside',

  // Painel com o fundo de rabiscos da conversa (recebe o papel de parede).
  chatBg: 'article.chat-messages-article',

  // Logo da empresa no header (âncora; contém o <img>). Recebe a logo personalizada.
  headerLogo: 'a.header-logo',

  // Painel de identificação do cliente (lead). Contém o link do sistema do cliente.
  chatAsideLead: 'section.chat-aside--lead',

  // --- Fluxo de finalização (dropdown nativo de motivos) ---
  // Dropdown que abre ao clicar em "finalizar" (busca + lista de motivos).
  subnav: '.subnav',
  subnavList: '.subnav-list',
  subnavSearchInput: '.subnav-search input, .subnav-search textarea, .subnav-search .input-field-inner input',
  // Cada item de motivo dentro da lista.
  subnavListItem: '.subnav-list button, .subnav-list a, .subnav-list li, .subnav-list [role="button"]',
};

// Extrai o ID estável do atendimento a partir do href (/chat/<uuid>).
window.CPC_getCardId = function (cardEl) {
  const href = cardEl.getAttribute('href') || '';
  const m = href.match(/\/chat\/([0-9a-fA-F-]+)/);
  return m ? m[1] : null;
};
