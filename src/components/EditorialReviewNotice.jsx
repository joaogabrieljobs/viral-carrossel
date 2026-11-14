import React from 'react';

function issueDescription(issue) {
  if (issue.kind === 'missing_title') return 'falta um título.';
  if (issue.kind === 'recovered_title' || issue.code === 'social_title_recovered') return 'título recuperado automaticamente do texto de apoio; confira antes de exportar.';
  if (issue.kind === 'factual') return `informação sem apoio suficiente no briefing${issue.claim ? `: “${issue.claim}”` : '.'}`;
  if (issue.kind === 'density') return 'texto acima do espaço previsto; reduza mantendo a ideia e as condições.';
  if (issue.code === 'missing_slides_padded') return 'a IA devolveu menos cards do que o pedido. Confira os espaços que ainda precisam de conteúdo.';
  if (issue.code === 'extra_slides_trimmed') return 'a sequência foi ajustada à quantidade pedida. Confira se a mensagem ficou completa.';
  if (issue.kind === 'normalization') return 'o conteúdo precisou de ajuste de estrutura. Confira a sequência e os campos recuperados.';
  return 'confira este ponto do rascunho antes de exportar.';
}

export default function EditorialReviewNotice({ status, issues = [], isPresentation = false, onReviewed }) {
  if (!['needs_attention', 'unavailable'].includes(status)) return null;
  const items = Array.isArray(issues) ? issues : [];
  const pages = [...new Set(items.filter(issue => Number.isInteger(issue.slideIndex) && issue.slideIndex >= 0)
    .map(issue => issue.slideIndex + 1))].sort((a, b) => a - b);
  const locations = [
    pages.length ? `${isPresentation ? 'Slides' : 'Cards'}: ${pages.join(', ')}` : '',
    items.some(issue => issue.field === 'caption' || issue.slideIndex === -1) ? 'Legenda' : '',
  ].filter(Boolean).join(' · ');
  return <section className="vc-editor-review-notice" aria-label="Revisão pendente do conteúdo">
    <strong>Rascunho preservado — revise antes de exportar</strong>
    <p>{status === 'unavailable'
      ? 'Este texto ainda não passou pela revisão automática. Confira as informações e o tamanho dos textos.'
      : 'A revisão encontrou pontos que precisam de conferência. Verifique as informações, os títulos e o tamanho dos textos.'}</p>
    {locations && <p>{locations}</p>}
    {items.length > 0 && <details>
      <summary>O que conferir</summary>
      <ul>{items.map((issue, index) => <li key={index}>
        <strong>{issue.field === 'caption' || issue.slideIndex === -1 ? 'Legenda'
          : Number.isInteger(issue.slideIndex) && issue.slideIndex >= 0 ? `${isPresentation ? 'Slide' : 'Card'} ${issue.slideIndex + 1}`
            : 'Estrutura do rascunho'}: </strong>
        {issueDescription(issue)}
      </li>)}</ul>
    </details>}
    <button type="button" className="vc-btn vc-btn-ghost" onClick={onReviewed}>Conferi o conteúdo</button>
  </section>;
}
