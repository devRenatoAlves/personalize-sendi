// Camada central de seletores DOM.
// Único lugar a atualizar se o Sendi mudar o layout. O Sendi é Vue + Tailwind/shadcn:
// as classes utilitárias mudam, então os seletores usam atributos estáveis
// (data-slot, data-message-id, aria-label, data-conversa-aberta).
window.CPC_SELECTORS = {
  // Painel da conversa aberta (contém header, mensagens e composer).
  chatSection: 'section:has(> header[data-conversa-aberta])',

  // Área das mensagens (recebe o papel de parede).
  chatBg: 'section:has(> header[data-conversa-aberta]) > div.relative.min-h-0',

  // Cabeçalho da conversa aberta e botão "Finalizar" dentro dele.
  chatHeader: 'header[data-conversa-aberta]',
  finalizeBtn: 'header[data-conversa-aberta] button[aria-label^="Finalizar"]',

  // Campo de resposta.
  composer: 'footer[data-slot="composer"] textarea',

  // Barra de botões do composer (Emoji, Anexar... Enviar): hospeda os botões da extensão.
  composerBar: 'footer[data-slot="composer"] form div.border-t',

  // Mensagens: cada uma tem data-message-id; recebidas = justify-start, enviadas = justify-end.
  message: '[data-message-id]',
  messageText: 'p.whitespace-pre-wrap',

  // Nome do contato no cabeçalho da conversa ("fulano - estabelecimento").
  contactName: 'header[data-conversa-aberta] button[title^="Ver dados"] p.truncate',

  // --- Fluxo de finalização (popover nativo de motivos) ---
  popover: '[data-slot="popover-content"]',
  reasonSearchInput: '[data-slot="command-input"]',
  reasonItem: '[data-slot="command-item"]',
};
