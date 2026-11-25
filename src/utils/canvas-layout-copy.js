// Textos da seção "Composição" que precisam citar um controle pelo nome que
// ele tem na tela. Ficam juntos para o aviso e o botão não se separarem.

/** Rótulo do botão que devolve os cards ao layout padrão. */
export const REMOVE_CANVAS_LAYOUT_LABEL = 'Remover composição (layout padrão)';

/** Aviso mostrado antes de ativar a composição em todos os cards. */
export function canvasLayoutScopeNotice(count, itemsLabel) {
  return `Muda o layout dos ${count} ${itemsLabel} deste projeto. Para voltar: ${REMOVE_CANVAS_LAYOUT_LABEL} ou Desfazer.`;
}

/**
 * Aviso depois de ativar a composição (QA 24/11, editor 8). Ela vale para o
 * projeto inteiro, então o próprio aviso leva o Desfazer. Devolve os
 * argumentos de `toast(mensagem, tipo, duração, opções)`.
 */
export function canvasLayoutEnabledToast(undo) {
  return [
    'Composição ativada em todos os cards. Ligue «Mostrar zonas» para mover e redimensionar.',
    'success',
    10000,
    { action: { label: 'Desfazer', onClick: () => undo?.() } },
  ];
}
