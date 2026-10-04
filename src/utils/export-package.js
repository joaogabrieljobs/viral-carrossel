/**
 * Pacote manual de publicação (Fatia 2): PNGs separados da legenda.
 * Não publica no Instagram — só prepara ficheiros e clipboard.
 */

export const PUBLISH_CHECKLIST = [
  { id: 'pngs', label: 'PNGs baixados' },
  { id: 'caption', label: 'Legenda copiada' },
  { id: 'instagram', label: 'Publicar no Instagram (fora do Viral)' },
  { id: 'mark', label: 'Marcar o projeto como Publicado na biblioteca' },
];

export async function copyTextToClipboard(text) {
  const value = String(text || '').trim();
  if (!value) throw new Error('Não há legenda para copiar. Gere uma legenda primeiro.');
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  if (!ok) throw new Error('Não foi possível copiar a legenda.');
}

/**
 * Baixa o ZIP dos cards e, se houver legenda, copia para a área de transferência.
 * @returns {{ captionCopied: boolean, checklist: typeof PUBLISH_CHECKLIST }}
 */
export async function exportCarouselPackage({ exportAll, caption = '' } = {}) {
  if (typeof exportAll !== 'function') throw new Error('Exportação indisponível.');
  await exportAll();
  const text = String(caption || '').trim();
  if (!text) {
    return { captionCopied: false, checklist: PUBLISH_CHECKLIST };
  }
  await copyTextToClipboard(text);
  return { captionCopied: true, checklist: PUBLISH_CHECKLIST };
}
