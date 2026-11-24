/**
 * Onde desenhar o par −/+ da caixa de texto do card ativo, em px relativos ao
 * card. `block` é a caixa do texto e `card` o tamanho do card, na mesma escala.
 *
 * Ao lado do bloco quando cabe (direita, depois esquerda). Sem espaço dos dois
 * lados, o par ia para 4 px da borda do card, por cima do texto; agora fica
 * acima do bloco, ou abaixo se o bloco está colado no topo. Só um bloco do
 * tamanho do card inteiro continua com o par por cima, no canto dele.
 */
export function textNudgePosition({ block, card, size = 26, gap = 6, spacing = 4, margin = 4 }) {
  const clusterW = size * 2 + spacing;
  const clampLeft = (value) => Math.max(margin, Math.min(value, card.width - clusterW - margin));
  const clampTop = (value) => Math.max(margin, Math.min(value, card.height - size - margin));
  const middle = clampTop(block.top + (block.bottom - block.top - size) / 2);

  const right = block.right + gap;
  if (right + clusterW <= card.width - margin) return { left: Math.max(margin, right), top: middle };
  const left = block.left - clusterW - gap;
  if (left >= margin) return { left, top: middle };

  // Alinhado à borda direita do bloco: é ela que anda quando a caixa muda.
  const aligned = clampLeft(block.right - clusterW);
  const above = block.top - size - gap;
  if (above >= margin) return { left: aligned, top: above };
  const below = block.bottom + gap;
  if (below + size <= card.height - margin) return { left: aligned, top: below };
  return { left: aligned, top: clampTop(block.top) };
}
