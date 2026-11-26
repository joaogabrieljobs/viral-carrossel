import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import EditorialReviewNotice from '../../src/components/EditorialReviewNotice.jsx';

const slides = [{ id: 's1' }, { id: 's2', bgImageFailed: true, presentationImageFallback: { reason: 'timeout' } }];
const render = (items, status = 'revised') => renderToStaticMarkup(React.createElement(EditorialReviewNotice, {
  slides: items, isPresentation: true, status, onRetryImage: () => {},
}));

describe('Teste 7: falha da foto aparece na revisão independente do texto', () => {
  it.each(['revised', 'reviewed_by_user'])('mostra aviso e regeneração no status %s', status => {
    const html = render(slides, status);
    expect(html).toContain('Imagens não geradas');
    expect(html).toContain('Slide 2');
    expect(html).toContain('Gerar imagem do slide 2');
    expect(html).not.toContain('timeout');
  });
  it('não deixa aviso depois da recuperação e não muda cards comuns', () => {
    expect(render([{ ...slides[1], bgImageFailed: false, presentationImageFallback: undefined }])).toBe('');
    expect(render([{ id: 'common', bgImageFailed: true }])).toBe('');
  });
});
