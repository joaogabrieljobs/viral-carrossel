// Textos da seção "Composição" que precisam citar um controle pelo nome que
// ele tem na tela. Ficam juntos para o aviso e o botão não se separarem.

/** Rótulo do botão que devolve os cards ao layout padrão. */
export const REMOVE_CANVAS_LAYOUT_LABEL = 'Remover composição (layout padrão)';

/** Aviso mostrado antes de ativar a composição em todos os cards. */
export function canvasLayoutScopeNotice(count, itemsLabel) {
  return `Muda o layout dos ${count} ${itemsLabel} deste projeto. Para voltar: ${REMOVE_CANVAS_LAYOUT_LABEL} ou Desfazer.`;
}
